import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { BookingsRepository } from './bookings.repository';
import { badRequest, conflict, forbidden, notFound } from '../../common/errors';
import { QueueService } from '../queue/queue.service';
import { AvailabilityService } from './availability.service';
import { RedisService } from '../../common/redis.service';
import { EarningsService } from '../commerce/earnings.service';
import { SettingsService } from '../../common/settings.service';

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
    .filter((tier): tier is RefundTier =>
      typeof tier === 'object' && tier !== null &&
      Number.isFinite((tier as RefundTier).beforeHours) &&
      Number.isFinite((tier as RefundTier).refundPercent))
    .sort((a, b) => b.beforeHours - a.beforeHours);
}

@Injectable()
export class BookingsService {
  constructor(
    private db: PrismaService, private repo: BookingsRepository,
    private redis: RedisService,
    private queue: QueueService,
    private availability: AvailabilityService,
    private earnings: EarningsService,
    private settings: SettingsService,
  ) {}

  async create(studentId:string,data:{teacherId:string;startsAt:string;type:'trial'|'regular';enrollmentId?:string;policyAccepted:boolean;timezone:string}) {
    if (!data.policyAccepted) throw badRequest(
      'CANCELLATION_POLICY_NOT_ACCEPTED',
      'برای ادامه باید سیاست لغو جلسه را مطالعه و تأیید کنید.',
      'Read and accept the cancellation policy before continuing.',
      { policyAccepted: { fa: 'تأیید سیاست لغو برای رزرو الزامی است.', en: 'Cancellation policy acceptance is required.' } },
    );
    const startsAt = new Date(data.startsAt);
    if (!Number.isFinite(startsAt.getTime()) || startsAt <= new Date()) throw badRequest(
      'BOOKING_START_INVALID',
      'زمان شروع باید یک تاریخ و ساعت معتبر در آینده باشد.',
      'The start time must be a valid future date and time.',
      { startsAt: { fa: 'تاریخ را از تقویم و ساعت را از فهرست نوبت‌های آزاد انتخاب کنید.', en: 'Choose a date from the calendar and a time from the available slots.' } },
    );
    await this.assertWithinBookingWindow(startsAt);
    const lock = await this.redis.lock(`booking:${data.teacherId}:${startsAt.toISOString()}`);
    if (!lock) throw conflict('SLOT_LOCKED', 'کاربر دیگری در حال رزرو این ساعت است. چند لحظه بعد دوباره تلاش کنید یا ساعت دیگری انتخاب کنید.', 'Another user is reserving this slot. Try again shortly or choose another time.');
    try {
      const booking = await this.db.$transaction(async (tx) => {
        const { teacher, endsAt } = await this.availability.assertSlotAvailable(tx, data.teacherId, startsAt, data.type);
        const studentOverlap = await tx.booking.count({
          where: { studentId, status: { in: ['PENDING_PAYMENT', 'CONFIRMED'] }, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } },
        });
        if (studentOverlap) throw conflict('STUDENT_BOOKING_OVERLAP', 'در این ساعت یک رزرو دیگر دارید. ساعت دیگری انتخاب کنید.', 'You already have another booking at this time. Choose another slot.');

        if (data.type === 'regular' && !data.enrollmentId) await this.assertTrialCompleted(tx, studentId, data.teacherId);
        if (data.type === 'trial') await this.assertTrialNotUsed(tx, studentId, data.teacherId);

        let enrollmentId: string | undefined;
        let creditBased = false;
        if (data.enrollmentId) {
          const enrollment = await tx.enrollment.findFirst({
            where: { id: data.enrollmentId, studentId, active: true, package: { teacherId: data.teacherId } },
          });
          if (!enrollment) throw badRequest('ENROLLMENT_INVALID', 'بسته آموزشی انتخاب‌شده معتبر یا فعال نیست.', 'The selected enrollment is invalid or inactive.', {
            enrollmentId: { fa: 'یک بسته فعال مربوط به همین مدرس را انتخاب کنید.', en: 'Choose an active package for this teacher.' },
          });
          const credits = await tx.creditEntry.aggregate({ where: { enrollmentId: data.enrollmentId }, _sum: { amount: true } });
          if ((credits._sum.amount ?? 0) < 1) throw badRequest('LESSON_CREDIT_INSUFFICIENT', 'اعتبار جلسه این بسته کافی نیست.', 'This enrollment does not have enough lesson credit.');
          enrollmentId = data.enrollmentId;
          creditBased = true;
        }
        const approvedPrice = data.type === 'trial' ? teacher.approvedTrialPrice : teacher.approvedRegularPrice;
        if (approvedPrice == null || approvedPrice <= 0) throw conflict('TEACHER_PRICE_NOT_APPROVED', 'قیمت این مدرس هنوز نهایی نشده و رزرو امکان‌پذیر نیست.', 'This teacher’s price is not finalized, so booking is unavailable.');
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
        if (creditBased) await tx.creditEntry.create({
          data: { enrollmentId: enrollmentId!, bookingId: created.id, type: 'RESERVE', amount: -1, idempotencyKey: `reserve:${created.id}` },
        });
        return created;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      if (booking.paymentExpiresAt) await this.queue.scheduleExpiration(booking.id, booking.paymentExpiresAt);
      else await this.queue.scheduleBooking(booking.id, booking.startsAt);
      return booking;
    } finally { await lock.release(); }
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
    if (leadMinutes < minLeadMinutes) throw badRequest(
      'BOOKING_LEAD_TIME_TOO_SHORT',
      `رزرو باید حداقل ${minLeadMinutes} دقیقه پیش از شروع کلاس انجام شود.`,
      `A lesson must be booked at least ${minLeadMinutes} minutes before it starts.`,
      { startsAt: { fa: 'یک نوبت با فاصله زمانی بیشتر انتخاب کنید.', en: 'Choose a slot further in the future.' } },
    );
    if (leadMinutes / 1_440 > maxAdvanceDays) throw badRequest(
      'BOOKING_TOO_FAR_AHEAD',
      `تا حداکثر ${maxAdvanceDays} روز آینده می‌توانید رزرو کنید.`,
      `You can book up to ${maxAdvanceDays} days ahead.`,
      { startsAt: { fa: 'یک نوبت نزدیک‌تر انتخاب کنید.', en: 'Choose an earlier slot.' } },
    );
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
    throw badRequest(
      'TRIAL_SESSION_REQUIRED',
      pendingTrial
        ? 'جلسه آزمایشی شما با این مدرس هنوز برگزار نشده است. پس از برگزاری آن می‌توانید کلاس عادی رزرو کنید.'
        : 'برای رزرو کلاس با این مدرس، ابتدا باید یک جلسه آزمایشی برگزار کنید.',
      pendingTrial
        ? 'Your trial session with this teacher has not taken place yet. You can book a regular lesson once it is done.'
        : 'You must take a trial session with this teacher before booking a regular lesson.',
      { type: { fa: 'ابتدا «جلسه آزمایشی» را انتخاب و رزرو کنید.', en: 'Select and book a trial session first.' } },
    );
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
    if (used) throw conflict(
      'TRIAL_ALREADY_USED',
      'شما قبلاً با این مدرس جلسه آزمایشی داشته‌اید. برای ادامه، کلاس عادی رزرو کنید.',
      'You have already had a trial session with this teacher. Book a regular lesson to continue.',
      { type: { fa: '«کلاس عادی» را انتخاب کنید.', en: 'Select a regular lesson instead.' } },
    );
  }

  list(userId:string,role:'student'|'teacher') {
    return role === 'student' ? this.repo.findStudentBookings(userId) : this.repo.findTeacherBookings(userId);
  }

  students(userId:string) {
    return this.repo.findTeacherStudents(userId);
  }

  async cancel(userId:string,id:string,reason:string) {
    if (!reason?.trim()) throw badRequest('CANCELLATION_REASON_REQUIRED', 'دلیل لغو را وارد کنید.', 'Enter a cancellation reason.');
    return this.db.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({ where: { id }, include: { payment: true } });
      if (!booking || booking.studentId !== userId) throw notFound('BOOKING_NOT_FOUND', 'رزرو پیدا نشد.', 'Booking was not found.');
      if (!['PENDING_PAYMENT', 'CONFIRMED'].includes(booking.status)) throw badRequest('BOOKING_NOT_CANCELLABLE', 'این رزرو در وضعیت فعلی قابل لغو نیست.', 'This booking cannot be cancelled in its current status.');
      const hours = (booking.startsAt.getTime() - Date.now()) / 3_600_000;
      const tiers = refundTiers(booking.policySnapshot);
      const refundPercent = tiers.find((tier) => hours >= tier.beforeHours)?.refundPercent ?? 0;
      await tx.booking.update({ where: { id }, data: { status: 'CANCELLED', cancelledAt: new Date(), cancellationReason: reason.trim() } });
      if (booking.enrollmentId) await tx.creditEntry.upsert({
        where: { idempotencyKey: `cancel-restore:${booking.id}` },
        create: { enrollmentId: booking.enrollmentId, bookingId: booking.id, type: 'RESTORE', amount: 1, idempotencyKey: `cancel-restore:${booking.id}` },
        update: {},
      });
      let refundAmount = 0;
      if (booking.payment?.status === 'PAID' && refundPercent > 0) {
        refundAmount = Math.floor(booking.payment.amount * refundPercent / 100);
        if (refundAmount > 0) {
          const refund = await tx.refund.upsert({
            where: { idempotencyKey: `booking-cancel:${booking.id}` },
            create: { paymentId: booking.payment.id, amount: refundAmount, reason: `booking-cancellation:${reason.trim()}`, status: 'completed', idempotencyKey: `booking-cancel:${booking.id}` },
            update: {},
          });
          await tx.walletEntry.upsert({
            where: { idempotencyKey: `refund-ledger:${refund.id}` },
            create: { userId: booking.studentId, transactionId: `tx_${refund.id}`, account: 'user_wallet', direction: 'CREDIT', amount: refundAmount, description: 'booking cancellation refund', referenceType: 'Refund', referenceId: refund.id, idempotencyKey: `refund-ledger:${refund.id}` },
            update: {},
          });
          await tx.payment.update({ where: { id: booking.payment.id }, data: { status: refundAmount === booking.payment.amount ? 'REFUNDED' : 'PARTIALLY_REFUNDED' } });
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
    const booking = await this.db.booking.findUnique({ where: { id }, include: { teacher: { select: { userId: true } } } });
    if (!booking) throw notFound('BOOKING_NOT_FOUND', 'رزرو پیدا نشد.', 'Booking was not found.');
    const party = booking.studentId === userId ? 'student' : booking.teacher.userId === userId ? 'teacher' : null;
    if (!party) throw notFound('BOOKING_NOT_FOUND', 'رزرو پیدا نشد.', 'Booking was not found.');
    if (booking.status !== 'CONFIRMED') throw badRequest('BOOKING_NOT_RESCHEDULABLE', 'فقط رزرو تأییدشده قابل جابه‌جایی است.', 'Only a confirmed booking can be rescheduled.');
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
    if (!Number.isFinite(startsAt.getTime()) || startsAt <= new Date()) throw badRequest('BOOKING_START_INVALID', 'زمان جدید باید در آینده باشد.', 'The new start time must be in the future.');
    await this.assertWithinBookingWindow(startsAt);
    await this.availability.assertSlotAvailable(this.db, booking.teacherId, startsAt, booking.type === 'trial' ? 'trial' : 'regular', id);
    const updated = await this.db.booking.update({
      where: { id },
      data: { reschedulerId: userId, rescheduleStartsAt: startsAt, rescheduleTimezone: data.timezone, rescheduleAskedAt: new Date() },
    });
    await this.db.notification.create({
      data: {
        userId: counterpartyId,
        type: 'BOOKING_RESCHEDULE_REQUESTED',
        titleFa: 'درخواست جابه‌جایی کلاس',
        titleEn: 'Lesson reschedule requested',
        bodyFa: `${party === 'student' ? 'زبان‌آموز' : 'مدرس'} پیشنهاد جابه‌جایی این کلاس را ثبت کرده است. برای تأیید یا رد آن به صفحه کلاس بروید.`,
        bodyEn: `The ${party} proposed a new time for this lesson. Open the lesson page to accept or decline.`,
        data: { bookingId: id, proposedStartsAt: startsAt.toISOString(), requestedBy: party, href: `/dashboard/bookings/${id}` },
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
    if (!booking.rescheduleStartsAt || !booking.reschedulerId) throw badRequest(
      'NO_RESCHEDULE_REQUEST',
      'درخواست جابه‌جایی فعالی برای این کلاس وجود ندارد.',
      'There is no active reschedule request for this lesson.',
    );
    // The proposer accepting their own request would make this unilateral again.
    if (booking.reschedulerId === userId) throw forbidden(
      'RESCHEDULE_SELF_ACCEPT',
      'تأیید جابه‌جایی باید توسط طرف دیگر انجام شود.',
      'The other party has to accept the reschedule.',
    );
    const startsAt = booking.rescheduleStartsAt;
    const timezone = booking.rescheduleTimezone ?? booking.timezone;
    if (startsAt <= new Date()) throw badRequest(
      'RESCHEDULE_REQUEST_STALE',
      'زمان پیشنهادی گذشته است. از طرف مقابل بخواهید زمان جدیدی پیشنهاد کند.',
      'The proposed time has passed. Ask the other party to propose a new one.',
    );
    const lock = await this.redis.lock(`booking:${booking.teacherId}:${startsAt.toISOString()}`);
    if (!lock) throw conflict('SLOT_LOCKED', 'کاربر دیگری در حال رزرو این ساعت است.', 'Another user is reserving this slot.');
    try {
      const moved = await this.db.$transaction(async (tx) => {
        const { endsAt } = await this.availability.assertSlotAvailable(tx, booking.teacherId, startsAt, booking.type === 'trial' ? 'trial' : 'regular', id);
        const overlap = await tx.booking.count({ where: { id: { not: id }, studentId: booking.studentId, status: { in: ['PENDING_PAYMENT', 'CONFIRMED'] }, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } } });
        if (overlap) throw conflict('STUDENT_BOOKING_OVERLAP', 'در زمان جدید یک رزرو دیگر دارید.', 'You already have another booking at the new time.');
        return tx.booking.update({
          where: { id },
          data: { startsAt, endsAt, timezone, reschedulerId: null, rescheduleStartsAt: null, rescheduleTimezone: null, rescheduleAskedAt: null },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
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
    } finally { await lock.release(); }
  }

  /** Declines the proposal and leaves the booking at its original time. */
  async declineReschedule(userId: string, id: string, reason?: string) {
    const { booking } = await this.partyOn(userId, id);
    if (!booking.rescheduleStartsAt || !booking.reschedulerId) throw badRequest(
      'NO_RESCHEDULE_REQUEST',
      'درخواست جابه‌جایی فعالی برای این کلاس وجود ندارد.',
      'There is no active reschedule request for this lesson.',
    );
    if (booking.reschedulerId === userId) throw forbidden(
      'RESCHEDULE_SELF_DECLINE',
      'رد درخواست باید توسط طرف دیگر انجام شود.',
      'The other party has to respond to the request.',
    );
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

  async attendance(actorId:string,roles:string[],id:string,data:{student?:boolean;teacher?:boolean;meetingUrl?:string}) {
    const booking = await this.db.booking.findUnique({ where: { id }, include: { teacher: true } });
    if (!booking) throw notFound('BOOKING_NOT_FOUND', 'رزرو پیدا نشد.', 'Booking was not found.');
    if (roles.includes('TEACHER') && booking.teacher.userId !== actorId) throw forbidden('BOOKING_OWNERSHIP_REQUIRED', 'فقط مدرس همین کلاس می‌تواند حضور را ثبت کند.', 'Only this booking’s teacher can record attendance.');
    if (booking.status !== 'CONFIRMED') throw badRequest('ATTENDANCE_STATUS_INVALID', 'ثبت حضور فقط برای رزرو تأییدشده ممکن است.', 'Attendance can only be recorded for a confirmed booking.');
    return this.db.booking.update({ where: { id }, data: { attendanceStudent: data.student, attendanceTeacher: data.teacher, meetingUrl: data.meetingUrl } });
  }

  async complete(actorId:string,roles:string[],id:string) {
    return this.db.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({ where: { id }, include: { teacher: true } });
      if (!booking) throw notFound('BOOKING_NOT_FOUND', 'رزرو پیدا نشد.', 'Booking was not found.');
      const isStaff = roles.some((role) => ['ADMIN', 'STAFF'].includes(role));
      if (!isStaff && booking.teacher.userId !== actorId) throw forbidden('BOOKING_OWNERSHIP_REQUIRED', 'فقط مدرس همین کلاس یا مدیر می‌تواند کلاس را تکمیل کند.', 'Only this booking’s teacher or an administrator can complete it.');
      if (booking.status !== 'CONFIRMED') throw badRequest('BOOKING_NOT_COMPLETABLE', 'فقط کلاس تأییدشده قابل تکمیل است.', 'Only a confirmed booking can be completed.');
      if (booking.endsAt > new Date()) throw badRequest(
        'BOOKING_NOT_ENDED',
        'کلاس هنوز به پایان نرسیده است و نمی‌توان آن را تکمیل کرد.',
        'The lesson has not ended yet and cannot be completed.',
        { booking: { fa: 'پس از پایان زمان کلاس دوباره اقدام کنید.', en: 'Try again after the scheduled lesson end time.' } },
      );
      if (!booking.attendanceTeacher) throw badRequest('TEACHER_ATTENDANCE_REQUIRED', 'قبل از تکمیل کلاس، حضور مدرس را ثبت کنید.', 'Record teacher attendance before completing the class.');
      const status = booking.attendanceStudent === false ? 'NO_SHOW' : 'COMPLETED';
      await tx.booking.update({ where: { id }, data: { status } });
      await tx.classRecord.upsert({ where: { bookingId: id }, create: { bookingId: id, completedAt: new Date() }, update: { completedAt: new Date() } });
      if (booking.enrollmentId) await tx.creditEntry.upsert({
        where: { idempotencyKey: `consume:${id}` },
        create: { enrollmentId: booking.enrollmentId, bookingId: id, type: 'CONSUME', amount: 0, idempotencyKey: `consume:${id}` },
        update: {},
      });
      if (status === 'COMPLETED' && booking.price > 0) {
        await this.earnings.accrue(tx, booking);
        await tx.notification.create({
          data: {
            userId: booking.studentId,
            type: 'BOOKING_REVIEW_REQUEST',
            titleFa: 'نظر شما درباره کلاس', titleEn: 'Rate your lesson',
            bodyFa: 'کلاس شما تکمیل شد. اکنون می‌توانید برای مدرس امتیاز و نظر ثبت کنید.',
            bodyEn: 'Your lesson is complete. You can now rate and review the teacher.',
            data: { bookingId: booking.id, teacherId: booking.teacherId, href: `/dashboard/bookings/${booking.id}` },
          },
        });
      }
      return { ok: true, status };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
