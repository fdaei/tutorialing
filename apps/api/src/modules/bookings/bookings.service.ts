import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { badRequest, conflict, forbidden, notFound } from '../../common/errors';
import { QueueService } from '../queue/queue.service';
import { AvailabilityService } from './availability.service';
import { RedisService } from './redis.service';

@Injectable()
export class BookingsService {
  constructor(
    private db: PrismaService,
    private redis: RedisService,
    private queue: QueueService,
    private availability: AvailabilityService,
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
    const lock = await this.redis.lock(`booking:${data.teacherId}:${startsAt.toISOString()}`);
    if (!lock) throw conflict('SLOT_LOCKED', 'کاربر دیگری در حال رزرو این ساعت است. چند لحظه بعد دوباره تلاش کنید یا ساعت دیگری انتخاب کنید.', 'Another user is reserving this slot. Try again shortly or choose another time.');
    try {
      const booking = await this.db.$transaction(async (tx) => {
        const { teacher, endsAt } = await this.availability.assertSlotAvailable(tx, data.teacherId, startsAt, data.type);
        const studentOverlap = await tx.booking.count({
          where: { studentId, status: { in: ['PENDING_PAYMENT', 'CONFIRMED'] }, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } },
        });
        if (studentOverlap) throw conflict('STUDENT_BOOKING_OVERLAP', 'در این ساعت یک رزرو دیگر دارید. ساعت دیگری انتخاب کنید.', 'You already have another booking at this time. Choose another slot.');

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

  list(userId:string,role:'student'|'teacher') {
    return this.db.booking.findMany({
      where: role === 'student' ? { studentId: userId } : { teacher: { userId } },
      include: {
        teacher: { select: { nameFa: true, nameEn: true, slug: true, languageLinks: { where: { active: true }, include: { language: true } } } },
        student: { select: { name: true, phone: true, email: true } },
        classRecord: true,
        payment: { select: { id: true, status: true, amount: true } },
        review: { select: { id: true, rating: true, moderationStatus: true } },
      },
      orderBy: { startsAt: 'asc' },
    });
  }

  students(userId:string) {
    return this.db.user.findMany({
      where: { bookings: { some: { teacher: { userId }, status: { in: ['CONFIRMED', 'COMPLETED'] } } } },
      select: {
        id: true, name: true, phone: true, email: true, locale: true,
        bookings: { where: { teacher: { userId } }, select: { id: true, status: true, startsAt: true, endsAt: true }, orderBy: { startsAt: 'desc' }, take: 5 },
        learningPlans: { where: { teacher: { userId } }, select: { id: true, title: true, targetBand: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 3 },
      },
      orderBy: { updatedAt: 'desc' }, take: 200,
    });
  }

  async cancel(userId:string,id:string,reason:string) {
    if (!reason?.trim()) throw badRequest('CANCELLATION_REASON_REQUIRED', 'دلیل لغو را وارد کنید.', 'Enter a cancellation reason.');
    return this.db.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({ where: { id }, include: { payment: true } });
      if (!booking || booking.studentId !== userId) throw notFound('BOOKING_NOT_FOUND', 'رزرو پیدا نشد.', 'Booking was not found.');
      if (!['PENDING_PAYMENT', 'CONFIRMED'].includes(booking.status)) throw badRequest('BOOKING_NOT_CANCELLABLE', 'این رزرو در وضعیت فعلی قابل لغو نیست.', 'This booking cannot be cancelled in its current status.');
      const hours = (booking.startsAt.getTime() - Date.now()) / 3_600_000;
      const tiers = ((booking.policySnapshot as { tiers?: { beforeHours: number; refundPercent: number }[] }).tiers ?? []).sort((a, b) => b.beforeHours - a.beforeHours);
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

  async reschedule(userId:string,id:string,data:{startsAt:string;timezone:string}) {
    const existing = await this.db.booking.findUnique({ where: { id } });
    if (!existing || existing.studentId !== userId) throw notFound('BOOKING_NOT_FOUND', 'رزرو پیدا نشد.', 'Booking was not found.');
    if (existing.status !== 'CONFIRMED') throw badRequest('BOOKING_NOT_RESCHEDULABLE', 'فقط رزرو تأییدشده قابل جابه‌جایی است.', 'Only a confirmed booking can be rescheduled.');
    const startsAt = new Date(data.startsAt);
    if (!Number.isFinite(startsAt.getTime()) || startsAt <= new Date()) throw badRequest('BOOKING_START_INVALID', 'زمان جدید باید در آینده باشد.', 'The new start time must be in the future.');
    const lock = await this.redis.lock(`booking:${existing.teacherId}:${startsAt.toISOString()}`);
    if (!lock) throw conflict('SLOT_LOCKED', 'کاربر دیگری در حال رزرو این ساعت است.', 'Another user is reserving this slot.');
    try {
      const booking = await this.db.$transaction(async (tx) => {
        const { endsAt } = await this.availability.assertSlotAvailable(tx, existing.teacherId, startsAt, existing.type === 'trial' ? 'trial' : 'regular', id);
        const overlap = await tx.booking.count({ where: { id: { not: id }, studentId: userId, status: { in: ['PENDING_PAYMENT', 'CONFIRMED'] }, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } } });
        if (overlap) throw conflict('STUDENT_BOOKING_OVERLAP', 'در زمان جدید یک رزرو دیگر دارید.', 'You already have another booking at the new time.');
        return tx.booking.update({ where: { id }, data: { startsAt, endsAt, timezone: data.timezone } });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      await this.queue.scheduleBooking(id, startsAt);
      return booking;
    } finally { await lock.release(); }
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
        const commission = Math.round(booking.price * 0.2);
        await tx.earning.upsert({
          where: { bookingId: id },
          create: { teacherId: booking.teacherId, bookingId: id, grossAmount: booking.price, commissionAmount: commission, netAmount: booking.price - commission, eligibleAt: new Date(Date.now() + 7 * 86_400_000) },
          update: {},
        });
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
