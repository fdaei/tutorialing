import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { badRequest, conflict, isPrismaKnownError, notFound } from '../../../common';
import { PaymentsService } from './payments.service';

export const PAYMENT_RECEIPT_PURPOSE = 'payment-receipt';
const RECEIPT_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

/**
 * Manual wallet top-ups while no payment gateway is live: the student transfers
 * card-to-card, uploads the bank receipt, and an admin approves or rejects it.
 * An approved receipt settles through `PaymentsService.settleVerified()` — the
 * same fulfilment path a gateway callback uses — so the ledger stays identical
 * to a gateway top-up once Zarinpal is enabled.
 */
@Injectable()
export class ReceiptTopUpsService {
  constructor(
    private readonly db: PrismaService,
    private readonly payments: PaymentsService,
  ) {}

  async submit(
    userId: string,
    input: {
      amount: number;
      receiptFileId: string;
      idempotencyKey: string;
      note?: string;
      courseId?: string;
      sessions?: Array<{ startsAt: string; endsAt: string; timezone: string }>;
    },
  ) {
    const replay = await this.db.payment.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (replay) {
      if (replay.userId !== userId) throw conflict('PAYMENT_KEY_CONFLICT');
      return replay;
    }
    const file = await this.db.storedFile.findFirst({
      where: {
        id: input.receiptFileId,
        ownerId: userId,
        status: 'SAFE',
        purpose: PAYMENT_RECEIPT_PURPOSE,
        mimeType: { in: RECEIPT_MIME_TYPES },
      },
      select: { id: true, _count: { select: { paymentReceipts: true } } },
    });
    if (!file) throw notFound('RECEIPT_FILE_NOT_FOUND');
    // One receipt backs one top-up; re-submitting the same bank slip must not
    // queue a second credit for the same transfer.
    if (file._count.paymentReceipts > 0) throw conflict('RECEIPT_ALREADY_SUBMITTED');
    // A course receipt is charged the course's own price, never the amount the
    // client typed, and enrolls the student once approved (see `fulfill`).
    let course: {
      id: string;
      price: number;
      format: string;
      teacherId: string | null;
      package: { credits: number } | null;
      teacher: { meetingUrl: string | null } | null;
    } | null = null;
    if (input.courseId) {
      course = await this.db.course.findFirst({
        where: { OR: [{ id: input.courseId }, { slug: input.courseId }], published: true },
        select: {
          id: true,
          price: true,
          format: true,
          teacherId: true,
          package: { select: { credits: true } },
          teacher: { select: { meetingUrl: true } },
        },
      });
      if (!course) throw notFound('COURSE_NOT_FOUND');
      const enrolled = await this.db.courseEnrollment.findUnique({
        where: { userId_courseId: { userId, courseId: course.id } },
        select: { id: true },
      });
      if (enrolled) throw conflict('COURSE_ALREADY_ENROLLED');
      const waiting = await this.db.payment.findFirst({
        where: { userId, purpose: 'course', referenceId: course.id, status: 'PENDING' },
        select: { id: true },
      });
      if (waiting) throw conflict('COURSE_RECEIPT_PENDING');
    }
    const sessions = input.sessions ?? [];
    if (course?.format === 'LIVE_ONLINE') {
      if (!course.teacherId || !course.package) throw badRequest('COURSE_SCHEDULE_NOT_CONFIGURED');
      // Scheduling all sessions up front is optional. When no sessions are
      // supplied, the student can pay first and schedule the package credits
      // later from their learning area.
      if (sessions.length !== 0 && sessions.length !== course.package.credits) {
        throw badRequest('COURSE_SESSION_COUNT_INVALID');
      }
      const normalized = sessions
        .map((session) => ({ ...session, startsAt: new Date(session.startsAt), endsAt: new Date(session.endsAt) }))
        .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
      for (let index = 0; index < normalized.length; index += 1) {
        const session = normalized[index]!;
        if (
          !Number.isFinite(session.startsAt.getTime()) ||
          !Number.isFinite(session.endsAt.getTime()) ||
          session.startsAt <= new Date() ||
          session.endsAt <= session.startsAt ||
          !session.timezone.trim()
        )
          throw badRequest('COURSE_SESSION_INVALID');
        if (index > 0 && normalized[index - 1]!.endsAt > session.startsAt) {
          throw conflict('COURSE_SESSIONS_OVERLAP');
        }
      }
    } else if (sessions.length) {
      throw badRequest('COURSE_SESSIONS_NOT_ALLOWED');
    }
    const amount = course ? course.price : input.amount;
    if (!course && amount < 10_000) throw badRequest('RECEIPT_AMOUNT_TOO_LOW');
    const id = `receipt_${randomUUID()}`;
    const paymentData = {
      id,
      userId,
      purpose: course ? 'course' : 'wallet_top_up',
      referenceId: course ? course.id : id,
      subtotal: amount,
      amount,
      gatewayAmount: amount,
      walletAmount: 0,
      status: 'PENDING' as const,
      idempotencyKey: input.idempotencyKey,
      receiptFileId: file.id,
      reviewNote: input.note?.trim() || null,
    };
    try {
      if (course?.format !== 'LIVE_ONLINE' || !course.teacherId) {
        return await this.db.payment.create({ data: paymentData });
      }
      return await this.db.$transaction(
        async (tx) => {
          for (const session of sessions) {
            const startsAt = new Date(session.startsAt),
              endsAt = new Date(session.endsAt);
            const overlap = await tx.booking.count({
              where: {
                teacherId: course.teacherId!,
                status: { in: ['PENDING_PAYMENT', 'CONFIRMED'] },
                startsAt: { lt: endsAt },
                endsAt: { gt: startsAt },
              },
            });
            if (overlap) throw conflict('SLOT_NOT_AVAILABLE');
          }
          return tx.payment.create({
            data: {
              ...paymentData,
              courseSessionBookings: {
                create: sessions.map((session) => ({
                  studentId: userId,
                  teacherId: course.teacherId!,
                  startsAt: new Date(session.startsAt),
                  endsAt: new Date(session.endsAt),
                  timezone: session.timezone,
                  type: 'course_session',
                  status: 'PENDING_PAYMENT',
                  price: 0,
                  policySnapshot: {},
                  meetingUrl: course.teacher?.meetingUrl ?? null,
                })),
              },
            },
            include: { courseSessionBookings: true },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (!isPrismaKnownError(error) || error.code !== 'P2002') throw error;
      const raced = await this.db.payment.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (!raced || raced.userId !== userId) throw conflict('PAYMENT_KEY_CONFLICT');
      return raced;
    }
  }

  async approve(actorId: string, paymentId: string, reference?: string) {
    const payment = await this.claim(actorId, paymentId, null);
    const paid = await this.payments.settleVerified(payment.id, reference?.trim() || undefined, {
      method: 'receipt',
      approvedBy: actorId,
    });
    await this.audit(actorId, 'finance.receipt.approve', payment.id, { status: paid.status, reference });
    return paid;
  }

  async reject(actorId: string, paymentId: string, reason: string) {
    if (!reason.trim()) throw badRequest('RECEIPT_REJECT_REASON_REQUIRED');
    const payment = await this.claim(actorId, paymentId, reason.trim());
    const failed = await this.payments.failPayment(payment.id, { method: 'receipt', rejectedBy: actorId });
    await this.audit(actorId, 'finance.receipt.reject', payment.id, { status: failed.status, reason: reason.trim() });
    return failed;
  }

  /**
   * Conditional update that lets exactly one reviewer act on a receipt, so a
   * concurrent approve + reject (or a double-click) can't both go through.
   */
  private async claim(actorId: string, paymentId: string, rejectReason: string | null) {
    const payment = await this.db.payment.findUnique({ where: { id: paymentId } });
    if (!payment || !payment.receiptFileId) throw notFound('PAYMENT_NOT_FOUND');
    if (payment.userId === actorId) throw badRequest('RECEIPT_SELF_REVIEW_FORBIDDEN');
    const claimed = await this.db.payment.updateMany({
      where: { id: paymentId, status: 'PENDING', reviewedAt: null },
      data: {
        reviewedById: actorId,
        reviewedAt: new Date(),
        ...(rejectReason ? { reviewNote: rejectReason } : {}),
      },
    });
    if (claimed.count !== 1) throw conflict('RECEIPT_ALREADY_REVIEWED');
    return payment;
  }

  private audit(actorId: string, action: string, paymentId: string, after: Record<string, unknown>) {
    return this.db.auditLog.create({
      data: { actorId, action, entity: 'Payment', entityId: paymentId, after: after as Prisma.InputJsonValue },
    });
  }
}
