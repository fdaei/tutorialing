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
    input: { amount: number; receiptFileId: string; idempotencyKey: string; note?: string; courseId?: string },
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
    let course: { id: string; price: number } | null = null;
    if (input.courseId) {
      course = await this.db.course.findFirst({
        where: { OR: [{ id: input.courseId }, { slug: input.courseId }], published: true },
        select: { id: true, price: true },
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
    const amount = course ? course.price : input.amount;
    if (!course && amount < 10_000) throw badRequest('RECEIPT_AMOUNT_TOO_LOW');
    const id = `receipt_${randomUUID()}`;
    try {
      return await this.db.payment.create({
        data: {
          id,
          userId,
          purpose: course ? 'course' : 'wallet_top_up',
          referenceId: course ? course.id : id,
          subtotal: amount,
          amount,
          gatewayAmount: amount,
          walletAmount: 0,
          status: 'PENDING',
          idempotencyKey: input.idempotencyKey,
          receiptFileId: file.id,
          reviewNote: input.note?.trim() || null,
        },
      });
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
