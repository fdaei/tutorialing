import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { BookingsRepository } from './bookings.repository';
import { badRequest, conflict, domainError, DOMAIN_ERRORS, forbidden, notFound } from '../../common';
import { QueueService } from '../queue/queue.service';
import { AvailabilityService } from './availability.service';
import { RedisService } from '../../infrastructure/cache/redis.service';
import { EarningsService } from '../commerce';
import { SettingsService } from '../../common';

type RefundTier = { beforeHours: number; refundPercent: number };

/**
 * Reads the cancellation tiers out of a booking's `policySnapshot`.
 *
 * The column is `Json`, which also admits JSON `null`, arrays, and scalars — a
 * teacher whose policy was never filled in, or seeded/legacy rows, can all leave
 * something other than an object in there. Reaching straight for `.tiers` on
 * that threw a TypeError inside the cancellation transaction, so the student
 * could not cancel at all. Anything unusable is treated as "no tiers agreed",
 * which yields a 0% refund — the same outcome the previous `?? []` produced for
 * an empty policy, without the crash.
 */
export function refundTiers(snapshot: Prisma.JsonValue): RefundTier[] {
  if (typeof snapshot !== 'object' || snapshot === null || Array.isArray(snapshot)) return [];
  const raw = (snapshot as Record<string, unknown>).tiers;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (tier): tier is RefundTier =>
        typeof tier === 'object' &&
        tier !== null &&
        Number.isFinite((tier as RefundTier).beforeHours) &&
        Number.isFinite((tier as RefundTier).refundPercent),
    )
    .sort((a, b) => b.beforeHours - a.beforeHours);
}

@Injectable()
export class BookingsService {
  constructor(
    private db: PrismaService,
    private repo: BookingsRepository,
    private redis: RedisService,
    private queue: QueueService,
    private availability: AvailabilityService,
    private earnings: EarningsService,
    private settings: SettingsService,
  ) {}

  async create(
    studentId: string,
    data: {
      teacherId: string;
      startsAt: string;
      type: 'trial' | 'regular';
      enrollmentId?: string;
      policyAccepted: boolean;
      timezone: string;
    },
  ) {
    if (!data.policyAccepted) throw badRequest('CANCELLATION_POLICY_NOT_ACCEPTED');
    const startsAt = new Date(data.startsAt);
    if (!Number.isFinite(startsAt.getTime()) || startsAt <= new Date()) throw badRequest('BOOKING_START_INVALID');
    await this.assertWithinBookingWindow(startsAt);
    const lock = await this.redis.lock(`booking:${data.teacherId}:${startsAt.toISOString()}`);
    if (!lock) throw conflict('SLOT_LOCKED');
    try {
      const booking = await this.db.$transaction(
        async (tx) => {
          const { teacher, endsAt } = await this.availability.assertSlotAvailable(
            tx,
            data.teacherId,
            startsAt,
            data.type,
          );
          const studentOverlap = await tx.booking.count({
            where: {
              studentId,
              status: { in: ['PENDING_PAYMENT', 'CONFIRMED'] },
              startsAt: { lt: endsAt },
              endsAt: { gt: startsAt },
            },
          });
          if (studentOverlap) throw conflict('STUDENT_BOOKING_OVERLAP');

          if (data.type === 'regular' && !data.enrollmentId)
            await this.assertTrialCompleted(tx, studentId, data.teacherId);
          if (data.type === 'trial') await this.assertTrialNotUsed(tx, studentId, data.teacherId);

          let enrollmentId: string | undefined;
          let creditBased = false;
          if (data.enrollmentId) {
            const enrollment = await tx.enrollment.findFirst({
              where: { id: data.enrollmentId, studentId, active: true, package: { teacherId: data.teacherId } },
            });
            if (!enrollment) throw badRequest('ENROLLMENT_INVALID');
            const credits = await tx.creditEntry.aggregate({
              where: { enrollmentId: data.enrollmentId },
              _sum: { amount: true },
            });
            if ((credits._sum.amount ?? 0) < 1) throw badRequest('LESSON_CREDIT_INSUFFICIENT');
            enrollmentId = data.enrollmentId;
            creditBased = true;
          }
          const approvedPrice = data.type === 'trial' ? teacher.approvedTrialPrice : teacher.approvedRegularPrice;
          if (approvedPrice == null || approvedPrice <= 0) {
            throw domainError(DOMAIN_ERRORS.TEACHER_PRICE_NOT_APPROVED);
          }
          const pendingPayment = !creditBased;
          const paymentExpiresAt = pendingPayment ? new Date(Date.now() + 15 * 60_000) : undefined;
          const created = await tx.booking.create({
            data: {
              studentId,
              teacherId: data.teacherId,
              enrollmentId,
              startsAt,
              endsAt,
              timezone: data.timezone,
              type: data.type,
              price: approvedPrice,
              policySnapshot: teacher.policy?.rules ?? {},
              paymentExpiresAt,
              status: pendingPayment ? 'PENDING_PAYMENT' : 'CONFIRMED',
            },
          });
          if (creditBased)
            await tx.creditEntry.create({
              data: {
                enrollmentId: enrollmentId!,
                bookingId: created.id,
                type: 'RESERVE',
                amount: -1,
                idempotencyKey: `reserve:${created.id}`,
              },
            });
          return created;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      if (booking.paymentExpiresAt) await this.queue.scheduleExpiration(booking.id, booking.paymentExpiresAt);
      else await this.queue.scheduleBooking(booking.id, booking.startsAt);
      return booking;
    } finally {
      await lock.release();
    }
  }

  /**
   * Enforces the booking window server-side. Both bounds were previously only
   * present in the frontend form, so a direct API call could book a lesson
   * starting in one minute — leaving the teacher no notice — or years ahead,
   * locking a slot indefinitely against a price that will have changed.
   */
  private async assertWithinBookingWindow(startsAt: Date) {
    const [minLeadMinutes, maxAdvanceDays] = await Promise.all([
      this.settings.numeric('booking.minLeadMinutes', 120, 10_080),
      this.settings.numeric('booking.maxAdvanceDays', 60, 730),
    ]);
    const leadMinutes = (startsAt.getTime() - Date.now()) / 60_000;
    if (leadMinutes < minLeadMinutes) throw badRequest('BOOKING_LEAD_TIME_TOO_SHORT');
    if (leadMinutes / 1_440 > maxAdvanceDays) throw badRequest('BOOKING_TOO_FAR_AHEAD');
  }

  /**
   * The trial session is mandatory: a student's first lesson with a given teacher
   * has to be a trial, so both sides can assess fit before committing to a full
   * class. Nothing enforced this, so a student could book straight into a regular
   * lesson. Credit-based bookings are exempt — buying a package is itself a
   * deliberate commitment, and the trial precedes the purchase.
   */
  private async assertTrialCompleted(tx: Prisma.TransactionClient, studentId: string, teacherId: string) {
    const priorTrial = await tx.booking.count({
      where: { studentId, teacherId, type: 'trial', status: { in: ['COMPLETED', 'NO_SHOW'] } },
    });
    if (priorTrial) return;
    const pendingTrial = await tx.booking.count({
      where: { studentId, teacherId, type: 'trial', status: { in: ['PENDING_PAYMENT', 'CONFIRMED'] } },
    });
    throw badRequest('TRIAL_SESSION_REQUIRED');
  }

  /**
   * The discounted trial is once per student-teacher pair. A cancelled trial does
   * not consume the entitlement, so a student whose trial fell through can still
   * take one; anything else already used it.
   */
  private async assertTrialNotUsed(tx: Prisma.TransactionClient, studentId: string, teacherId: string) {
    const used = await tx.booking.count({
      where: { studentId, teacherId, type: 'trial', status: { notIn: ['CANCELLED'] } },
    });
    if (used) throw conflict('TRIAL_ALREADY_USED');
  }

  list(userId: string, role: 'student' | 'teacher') {
    return role === 'student' ? this.repo.findStudentBookings(userId) : this.repo.findTeacherBookings(userId);
  }

  students(userId: string) {
    return this.repo.findTeacherStudents(userId);
  }

  async cancel(userId: string, id: string, reason: string) {
    if (!reason?.trim()) throw badRequest('CANCELLATION_REASON_REQUIRED');
    return this.db.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({ where: { id }, include: { payment: true } });
      if (!booking || booking.studentId !== userId) throw notFound('BOOKING_NOT_FOUND');
      if (!['PENDING_PAYMENT', 'CONFIRMED'].includes(booking.status)) throw badRequest('BOOKING_NOT_CANCELLABLE');
      const hours = (booking.startsAt.getTime() - Date.now()) / 3_600_000;
      const tiers = refundTiers(booking.policySnapshot);
      const refundPercent = tiers.find((tier) => hours >= tier.beforeHours)?.refundPercent ?? 0;
      await tx.booking.update({
        where: { id },
        data: { status: 'CANCELLED', cancelledAt: new Date(), cancellationReason: reason.trim() },
      });
      if (booking.enrollmentId)
        await tx.creditEntry.upsert({
          where: { idempotencyKey: `cancel-restore:${booking.id}` },
          create: {
            enrollmentId: booking.enrollmentId,
            bookingId: booking.id,
            type: 'RESTORE',
            amount: 1,
            idempotencyKey: `cancel-restore:${booking.id}`,
          },
          update: {},
        });
      let refundAmount = 0;
      if (booking.payment?.status === 'PAID' && refundPercent > 0) {
        refundAmount = Math.floor((booking.payment.amount * refundPercent) / 100);
        if (refundAmount > 0) {
          const refund = await tx.refund.upsert({
            where: { idempotencyKey: `booking-cancel:${booking.id}` },
            create: {
              paymentId: booking.payment.id,
              amount: refundAmount,
              reason: `booking-cancellation:${reason.trim()}`,
              status: 'completed',
              idempotencyKey: `booking-cancel:${booking.id}`,
            },
            update: {},
          });
          await tx.walletEntry.upsert({
            where: { idempotencyKey: `refund-ledger:${refund.id}` },
            create: {
              userId: booking.studentId,
              transactionId: `tx_${refund.id}`,
              account: 'user_wallet',
              direction: 'CREDIT',
              amount: refundAmount,
              description: 'booking cancellation refund',
              referenceType: 'Refund',
              referenceId: refund.id,
              idempotencyKey: `refund-ledger:${refund.id}`,
            },
            update: {},
          });
          await tx.payment.update({
            where: { id: booking.payment.id },
            data: { status: refundAmount === booking.payment.amount ? 'REFUNDED' : 'PARTIALLY_REFUNDED' },
          });
        }
      }
      return { bookingId: id, refundPercent, refundAmount };
    });
  }

  /**
   * Loads a booking either side of the engagement may act on, and reports which
   * side the caller is. Rescheduling used to be student-only and unilateral.
   */
  private async partyOn(userId: string, id: string) {
    const booking = await this.db.booking.findUnique({
      where: { id },
      include: { teacher: { select: { userId: true } } },
    });
    if (!booking) throw notFound('BOOKING_NOT_FOUND');
    const party = booking.studentId === userId ? 'student' : booking.teacher.userId === userId ? 'teacher' : null;
    if (!party) throw notFound('BOOKING_NOT_FOUND');
    if (booking.status !== 'CONFIRMED') throw badRequest('BOOKING_NOT_RESCHEDULABLE');
    return { booking, party, counterpartyId: party === 'student' ? booking.teacher.userId : booking.studentId };
  }

  /**
   * Proposes a new time. Rescheduling has to be agreed by both sides and
   * coordinated through the platform, so this only records the proposal and
   * notifies the counterparty — the booking does not move until they accept.
   * Either party may propose.
   *
   * The proposed slot is validated now so an impossible time is rejected while
   * the proposer is still there to pick another, and validated again on accept
   * because the slot can be taken in between.
   */
  async requestReschedule(userId: string, id: string, data: { startsAt: string; timezone: string }) {
    const { booking, party, counterpartyId } = await this.partyOn(userId, id);
    const startsAt = new Date(data.startsAt);
    if (!Number.isFinite(startsAt.getTime()) || startsAt <= new Date()) throw badRequest('BOOKING_START_INVALID');
    await this.assertWithinBookingWindow(startsAt);
    await this.availability.assertSlotAvailable(
      this.db,
      booking.teacherId,
      startsAt,
      booking.type === 'trial' ? 'trial' : 'regular',
      id,
    );
    const updated = await this.db.booking.update({
      where: { id },
      data: {
        reschedulerId: userId,
        rescheduleStartsAt: startsAt,
        rescheduleTimezone: data.timezone,
        rescheduleAskedAt: new Date(),
      },
    });
    await this.db.notification.create({
      data: {
        userId: counterpartyId,
        type: 'BOOKING_RESCHEDULE_REQUESTED',
        titleFa: 'درخواست جابه‌جایی کلاس',
        titleEn: 'Lesson reschedule requested',
        bodyFa: `${party === 'student' ? 'زبان‌آموز' : 'مدرس'} پیشنهاد جابه‌جایی این کلاس را ثبت کرده است. برای تأیید یا رد آن به صفحه کلاس بروید.`,
        bodyEn: `The ${party} proposed a new time for this lesson. Open the lesson page to accept or decline.`,
        data: {
          bookingId: id,
          proposedStartsAt: startsAt.toISOString(),
          requestedBy: party,
          href: `/dashboard/bookings/${id}`,
        },
      },
    });
    return { bookingId: id, status: 'reschedule_requested', proposedStartsAt: updated.rescheduleStartsAt };
  }

  /**
   * Accepts the counterparty's proposal and performs the move. Guarded by the
   * same Redis lock and Serializable re-check as a fresh booking, because the
   * proposed slot may have been taken while the proposal sat waiting.
   */
  async acceptReschedule(userId: string, id: string) {
    const { booking, party } = await this.partyOn(userId, id);
    if (!booking.rescheduleStartsAt || !booking.reschedulerId) throw badRequest('NO_RESCHEDULE_REQUEST');
    // The proposer accepting their own request would make this unilateral again.
    if (booking.reschedulerId === userId) throw forbidden('RESCHEDULE_SELF_ACCEPT');
    const startsAt = booking.rescheduleStartsAt;
    const timezone = booking.rescheduleTimezone ?? booking.timezone;
    if (startsAt <= new Date()) throw badRequest('RESCHEDULE_REQUEST_STALE');
    const lock = await this.redis.lock(`booking:${booking.teacherId}:${startsAt.toISOString()}`);
    if (!lock) throw conflict('SLOT_LOCKED');
    try {
      const moved = await this.db.$transaction(
        async (tx) => {
          const { endsAt } = await this.availability.assertSlotAvailable(
            tx,
            booking.teacherId,
            startsAt,
            booking.type === 'trial' ? 'trial' : 'regular',
            id,
          );
          const overlap = await tx.booking.count({
            where: {
              id: { not: id },
              studentId: booking.studentId,
              status: { in: ['PENDING_PAYMENT', 'CONFIRMED'] },
              startsAt: { lt: endsAt },
              endsAt: { gt: startsAt },
            },
          });
          if (overlap) throw conflict('STUDENT_BOOKING_OVERLAP');
          return tx.booking.update({
            where: { id },
            data: {
              startsAt,
              endsAt,
              timezone,
              reschedulerId: null,
              rescheduleStartsAt: null,
              rescheduleTimezone: null,
              rescheduleAskedAt: null,
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      await this.queue.scheduleBooking(id, startsAt);
      await this.db.notification.create({
        data: {
          userId: booking.reschedulerId,
          type: 'BOOKING_RESCHEDULE_ACCEPTED',
          titleFa: 'جابه‌جایی کلاس تأیید شد',
          titleEn: 'Reschedule accepted',
          bodyFa: 'درخواست جابه‌جایی شما تأیید شد و زمان کلاس به‌روزرسانی شده است.',
          bodyEn: 'Your reschedule request was accepted and the lesson time has been updated.',
          data: { bookingId: id, startsAt: startsAt.toISOString(), acceptedBy: party },
        },
      });
      return moved;
    } finally {
      await lock.release();
    }
  }

  /** Declines the proposal and leaves the booking at its original time. */
  async declineReschedule(userId: string, id: string, reason?: string) {
    const { booking } = await this.partyOn(userId, id);
    if (!booking.rescheduleStartsAt || !booking.reschedulerId) throw badRequest('NO_RESCHEDULE_REQUEST');
    if (booking.reschedulerId === userId) throw forbidden('RESCHEDULE_SELF_DECLINE');
    await this.db.booking.update({
      where: { id },
      data: { reschedulerId: null, rescheduleStartsAt: null, rescheduleTimezone: null, rescheduleAskedAt: null },
    });
    await this.db.notification.create({
      data: {
        userId: booking.reschedulerId,
        type: 'BOOKING_RESCHEDULE_DECLINED',
        titleFa: 'درخواست جابه‌جایی رد شد',
        titleEn: 'Reschedule declined',
        bodyFa: `درخواست جابه‌جایی شما پذیرفته نشد و کلاس در زمان قبلی برگزار می‌شود.${reason?.trim() ? ` دلیل: ${reason.trim()}` : ''}`,
        bodyEn: `Your reschedule request was declined and the lesson stays at its original time.${reason?.trim() ? ` Reason: ${reason.trim()}` : ''}`,
        data: { bookingId: id, reason: reason?.trim() ?? null },
      },
    });
    return { bookingId: id, status: 'reschedule_declined' };
  }

  async attendance(
    actorId: string,
    roles: string[],
    id: string,
    data: { student?: boolean; teacher?: boolean; meetingUrl?: string },
  ) {
    const booking = await this.db.booking.findUnique({ where: { id }, include: { teacher: true } });
    if (!booking) throw notFound('BOOKING_NOT_FOUND');
    if (roles.includes('TEACHER') && booking.teacher.userId !== actorId) throw forbidden('BOOKING_OWNERSHIP_REQUIRED');
    if (booking.status !== 'CONFIRMED') throw badRequest('ATTENDANCE_STATUS_INVALID');
    return this.db.booking.update({
      where: { id },
      data: { attendanceStudent: data.student, attendanceTeacher: data.teacher, meetingUrl: data.meetingUrl },
    });
  }

  async complete(actorId: string, roles: string[], id: string) {
    return this.db.$transaction(
      async (tx) => {
        const booking = await tx.booking.findUnique({ where: { id }, include: { teacher: true } });
        if (!booking) throw notFound('BOOKING_NOT_FOUND');
        const isStaff = roles.some((role) => ['ADMIN', 'STAFF'].includes(role));
        if (!isStaff && booking.teacher.userId !== actorId) throw forbidden('BOOKING_OWNERSHIP_REQUIRED');
        if (booking.status !== 'CONFIRMED') throw badRequest('BOOKING_NOT_COMPLETABLE');
        if (booking.endsAt > new Date()) throw badRequest('BOOKING_NOT_ENDED');
        if (!booking.attendanceTeacher) throw badRequest('TEACHER_ATTENDANCE_REQUIRED');
        const status = booking.attendanceStudent === false ? 'NO_SHOW' : 'COMPLETED';
        await tx.booking.update({ where: { id }, data: { status } });
        await tx.classRecord.upsert({
          where: { bookingId: id },
          create: { bookingId: id, completedAt: new Date() },
          update: { completedAt: new Date() },
        });
        if (booking.enrollmentId)
          await tx.creditEntry.upsert({
            where: { idempotencyKey: `consume:${id}` },
            create: {
              enrollmentId: booking.enrollmentId,
              bookingId: id,
              type: 'CONSUME',
              amount: 0,
              idempotencyKey: `consume:${id}`,
            },
            update: {},
          });
        if (status === 'COMPLETED' && booking.price > 0) {
          await this.earnings.accrue(tx, booking);
          await tx.notification.create({
            data: {
              userId: booking.studentId,
              type: 'BOOKING_REVIEW_REQUEST',
              titleFa: 'نظر شما درباره کلاس',
              titleEn: 'Rate your lesson',
              bodyFa: 'کلاس شما تکمیل شد. اکنون می‌توانید برای مدرس امتیاز و نظر ثبت کنید.',
              bodyEn: 'Your lesson is complete. You can now rate and review the teacher.',
              data: { bookingId: booking.id, teacherId: booking.teacherId, href: `/dashboard/bookings/${booking.id}` },
            },
          });
        }
        return { ok: true, status };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
