import { Injectable } from '@nestjs/common';
import { PriceStatus, Role } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { badRequest, forbidden, notFound } from '../../common/errors';

@Injectable()
export class PricingService {
  constructor(private readonly db: PrismaService) {}

  mine(userId: string) {
    return this.db.teacher.findUnique({
      where: { userId },
      select: {
        id: true,
        proposedTrialPrice: true,
        proposedRegularPrice: true,
        approvedTrialPrice: true,
        approvedRegularPrice: true,
        counterTrialPrice: true,
        counterRegularPrice: true,
        priceStatus: true,
        priceReviewNote: true,
        priceReviewedAt: true,
        trialDuration: true,
        lessonDuration: true,
        priceHistory: { orderBy: { createdAt: 'desc' }, take: 30 },
      },
    });
  }

  private validatePrices(trialPrice: number, regularPrice: number) {
    if (!Number.isInteger(trialPrice) || trialPrice < 10_000) {
      throw badRequest(
        'TRIAL_PRICE_INVALID',
        'قیمت پیشنهادی جلسه آزمایشی باید یک عدد صحیح و حداقل ۱۰٬۰۰۰ تومان باشد.',
        'The proposed trial price must be a whole number of at least 10,000.',
        { proposedTrialPrice: { fa: 'قیمت را بدون اعشار و به تومان وارد کنید.', en: 'Enter a whole-number price in the platform currency.' } },
      );
    }
    if (!Number.isInteger(regularPrice) || regularPrice < 10_000) {
      throw badRequest(
        'REGULAR_PRICE_INVALID',
        'قیمت پیشنهادی جلسه عادی باید یک عدد صحیح و حداقل ۱۰٬۰۰۰ تومان باشد.',
        'The proposed regular price must be a whole number of at least 10,000.',
        { proposedRegularPrice: { fa: 'قیمت را بدون اعشار و به تومان وارد کنید.', en: 'Enter a whole-number price in the platform currency.' } },
      );
    }
    if (regularPrice < trialPrice) {
      throw badRequest(
        'REGULAR_PRICE_BELOW_TRIAL',
        'قیمت جلسه عادی نباید کمتر از جلسه آزمایشی باشد.',
        'The regular lesson price cannot be lower than the trial price.',
        { proposedRegularPrice: { fa: 'قیمتی برابر یا بیشتر از جلسه آزمایشی وارد کنید.', en: 'Enter a value equal to or higher than the trial price.' } },
      );
    }
  }

  async propose(userId: string, trialPrice: number, regularPrice: number) {
    this.validatePrices(trialPrice, regularPrice);
    return this.db.$transaction(async (tx) => {
      const teacher = await tx.teacher.findUnique({ where: { userId } });
      if (!teacher) throw notFound('TEACHER_NOT_FOUND', 'پروفایل مدرس پیدا نشد.', 'Teacher profile not found.');
      if (['SUBMITTED', 'UNDER_REVIEW'].includes(teacher.priceStatus)) {
        throw badRequest('PRICE_ALREADY_UNDER_REVIEW', 'قیمت فعلی هنوز در حال بررسی است.', 'The current price proposal is still under review.');
      }
      const updated = await tx.teacher.update({
        where: { id: teacher.id },
        data: {
          proposedTrialPrice: trialPrice,
          proposedRegularPrice: regularPrice,
          counterTrialPrice: null,
          counterRegularPrice: null,
          priceStatus: 'SUBMITTED',
          priceReviewNote: null,
          priceReviewedAt: null,
          priceReviewedById: null,
        },
      });
      await tx.teacherPriceHistory.create({
        data: {
          teacherId: teacher.id,
          actorId: userId,
          actorRole: 'TEACHER',
          action: 'teacher.proposed',
          status: 'SUBMITTED',
          proposedTrialPrice: trialPrice,
          proposedRegularPrice: regularPrice,
        },
      });
      await tx.auditLog.create({ data: { actorId: userId, action: 'teacher.price.proposed', entity: 'Teacher', entityId: teacher.id, after: { trialPrice, regularPrice } } });
      return updated;
    });
  }

  async acceptCounter(userId: string) {
    return this.db.$transaction(async (tx) => {
      const teacher = await tx.teacher.findUnique({ where: { userId } });
      if (!teacher) throw notFound('TEACHER_NOT_FOUND', 'پروفایل مدرس پیدا نشد.', 'Teacher profile not found.');
      if (teacher.priceStatus !== 'COUNTER_OFFER' || teacher.counterTrialPrice == null || teacher.counterRegularPrice == null) {
        throw badRequest('COUNTER_OFFER_NOT_AVAILABLE', 'پیشنهاد متقابل فعالی برای پذیرش وجود ندارد.', 'There is no active counter-offer to accept.');
      }
      const updated = await tx.teacher.update({
        where: { id: teacher.id },
        data: {
          proposedTrialPrice: teacher.counterTrialPrice,
          proposedRegularPrice: teacher.counterRegularPrice,
          counterTrialPrice: null,
          counterRegularPrice: null,
          priceStatus: 'SUBMITTED',
          priceReviewNote: null,
          priceReviewedAt: null,
          priceReviewedById: null,
        },
      });
      await tx.teacherPriceHistory.create({
        data: {
          teacherId: teacher.id,
          actorId: userId,
          actorRole: 'TEACHER',
          action: 'teacher.counter.accepted',
          status: 'SUBMITTED',
          proposedTrialPrice: teacher.counterTrialPrice,
          proposedRegularPrice: teacher.counterRegularPrice,
          counterTrialPrice: teacher.counterTrialPrice,
          counterRegularPrice: teacher.counterRegularPrice,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'teacher.price.counter.accepted',
          entity: 'Teacher',
          entityId: teacher.id,
          before: { status: teacher.priceStatus, counterTrialPrice: teacher.counterTrialPrice, counterRegularPrice: teacher.counterRegularPrice },
          after: { status: 'SUBMITTED', proposedTrialPrice: teacher.counterTrialPrice, proposedRegularPrice: teacher.counterRegularPrice },
        },
      });
      return updated;
    });
  }

  async adminList(page: number, limit: number, status?: PriceStatus, search = '') {
    const where = {
      ...(status && { priceStatus: status }),
      ...(search && { OR: [{ nameFa: { contains: search, mode: 'insensitive' as const } }, { nameEn: { contains: search, mode: 'insensitive' as const } }, { user: { phone: { contains: search } } }] }),
    };
    const [data, total] = await this.db.$transaction([
      this.db.teacher.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { name: true, phone: true, email: true } },
          languageLinks: { include: { language: true } },
          priceHistory: { orderBy: { createdAt: 'desc' }, take: 10 },
        },
        orderBy: [{ priceReviewedAt: 'asc' }, { updatedAt: 'desc' }],
      }),
      this.db.teacher.count({ where }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async review(
    actorId: string,
    actorRoles: string[],
    teacherId: string,
    input: { action: 'start_review' | 'counter' | 'reject' | 'recommend_approval' | 'approve'; counterTrialPrice?: number; counterRegularPrice?: number; note?: string },
  ) {
    return this.db.$transaction(async (tx) => {
      const teacher = await tx.teacher.findUnique({ where: { id: teacherId } });
      if (!teacher) throw notFound('TEACHER_NOT_FOUND', 'مدرس پیدا نشد.', 'Teacher not found.');
      if (teacher.proposedTrialPrice == null || teacher.proposedRegularPrice == null) {
        throw badRequest('PRICE_PROPOSAL_MISSING', 'مدرس هنوز قیمت پیشنهادی ثبت نکرده است.', 'The teacher has not submitted a price proposal yet.');
      }

      let status: PriceStatus;
      const data: Record<string, unknown> = { priceReviewedById: actorId, priceReviewedAt: new Date(), priceReviewNote: input.note };
      if (input.action === 'start_review' || input.action === 'recommend_approval') {
        status = 'UNDER_REVIEW';
      } else if (input.action === 'counter') {
        if (input.counterTrialPrice == null || input.counterRegularPrice == null) {
          throw badRequest('COUNTER_PRICE_REQUIRED', 'برای پیشنهاد متقابل، هر دو قیمت آزمایشی و عادی را وارد کنید.', 'Both trial and regular counter prices are required.');
        }
        this.validatePrices(input.counterTrialPrice, input.counterRegularPrice);
        status = 'COUNTER_OFFER';
        data.counterTrialPrice = input.counterTrialPrice;
        data.counterRegularPrice = input.counterRegularPrice;
      } else if (input.action === 'reject') {
        if (!input.note?.trim()) throw badRequest('PRICE_REJECTION_NOTE_REQUIRED', 'دلیل رد قیمت را دقیق بنویسید.', 'Provide a clear reason for rejecting the price.');
        status = 'REJECTED';
      } else {
        if (!actorRoles.includes('ADMIN')) throw forbidden('FINAL_PRICE_ADMIN_ONLY', 'تأیید نهایی قیمت فقط توسط مدیر انجام می‌شود.', 'Only an administrator can grant final price approval.');
        status = 'APPROVED';
        data.approvedTrialPrice = teacher.proposedTrialPrice;
        data.approvedRegularPrice = teacher.proposedRegularPrice;
        data.trialPrice = teacher.proposedTrialPrice;
        data.regularPrice = teacher.proposedRegularPrice;
        data.counterTrialPrice = null;
        data.counterRegularPrice = null;
      }
      data.priceStatus = status;
      const updated = await tx.teacher.update({ where: { id: teacherId }, data });
      const actorRole = (actorRoles.find((role) => ['ADMIN', 'STAFF', 'FINANCE'].includes(role)) ?? 'STAFF') as Role;
      await tx.teacherPriceHistory.create({
        data: {
          teacherId,
          actorId,
          actorRole,
          action: `review.${input.action}`,
          status,
          proposedTrialPrice: teacher.proposedTrialPrice,
          proposedRegularPrice: teacher.proposedRegularPrice,
          approvedTrialPrice: status === 'APPROVED' ? teacher.proposedTrialPrice : teacher.approvedTrialPrice,
          approvedRegularPrice: status === 'APPROVED' ? teacher.proposedRegularPrice : teacher.approvedRegularPrice,
          counterTrialPrice: input.counterTrialPrice,
          counterRegularPrice: input.counterRegularPrice,
          note: input.note,
        },
      });
      await tx.auditLog.create({ data: { actorId, action: `teacher.price.${input.action}`, entity: 'Teacher', entityId: teacherId, before: { status: teacher.priceStatus }, after: { status, note: input.note } } });
      await tx.notification.create({
        data: {
          userId: teacher.userId,
          type: 'TEACHER_PRICE_REVIEWED',
          titleFa: 'وضعیت قیمت‌گذاری به‌روزرسانی شد',
          titleEn: 'Pricing status updated',
          bodyFa: status === 'APPROVED' ? 'قیمت‌های شما تأیید و در پروفایل عمومی منتشر شد.' : `وضعیت قیمت‌گذاری شما به ${status} تغییر کرد.${input.note ? ` توضیح: ${input.note}` : ''}`,
          bodyEn: status === 'APPROVED' ? 'Your prices were approved and published on your public profile.' : `Your pricing status changed to ${status}.${input.note ? ` Note: ${input.note}` : ''}`,
          data: { teacherId, status, path: '/teacher-panel/pricing' },
        },
      });
      return updated;
    });
  }
}
