import { Injectable } from '@nestjs/common';
import { PriceStatus, Role } from '@prisma/client';
import { PrismaService, type Tx } from '../../infrastructure/database/prisma.service';
import { badRequest, forbidden, notFound } from '../../common';

/**
 * The trial session is half the regular lesson price. Rounded down to a whole
 * unit of currency so an odd regular price cannot produce a fractional amount —
 * every price in the system is an integer.
 */
export const expectedTrialPrice = (regularPrice: number) => Math.floor(regularPrice / 2);

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
      throw badRequest('TRIAL_PRICE_INVALID');
    }
    if (!Number.isInteger(regularPrice) || regularPrice < 10_000) {
      throw badRequest('REGULAR_PRICE_INVALID');
    }
    if (regularPrice < trialPrice) {
      throw badRequest('REGULAR_PRICE_BELOW_TRIAL');
    }
    // The trial is priced at half the regular lesson by policy, not by teacher
    // choice. Only `regular >= trial` was checked, so any trial price up to the
    // full lesson rate was accepted and the discount could silently vanish.
    if (trialPrice !== expectedTrialPrice(regularPrice)) {
      throw badRequest('TRIAL_PRICE_NOT_HALF_REGULAR');
    }
  }

  /**
   * Puts a pair of prices in front of the reviewers.
   *
   * Both routes into review land here — the teacher naming their own price and
   * the teacher accepting the reviewer's counter — and both have to leave the
   * record in exactly the same shape: the counter cleared (it has either been
   * superseded or consumed) and the previous verdict wiped, so a stale note or
   * reviewer id cannot be read as a decision on the new proposal. Keeping that
   * reset in one place is what stops the two paths from drifting.
   */
  private submitForReview(tx: Tx, teacherId: string, trialPrice: number, regularPrice: number) {
    return tx.teacher.update({
      where: { id: teacherId },
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
  }

  async propose(userId: string, trialPrice: number, regularPrice: number) {
    this.validatePrices(trialPrice, regularPrice);
    return this.db.$transaction(async (tx) => {
      const teacher = await tx.teacher.findUnique({ where: { userId } });
      if (!teacher) throw notFound('TEACHER_NOT_FOUND');
      if (['SUBMITTED', 'UNDER_REVIEW'].includes(teacher.priceStatus)) {
        throw badRequest('PRICE_ALREADY_UNDER_REVIEW');
      }
      const updated = await this.submitForReview(tx, teacher.id, trialPrice, regularPrice);
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
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'teacher.price.proposed',
          entity: 'Teacher',
          entityId: teacher.id,
          after: { trialPrice, regularPrice },
        },
      });
      return updated;
    });
  }

  async acceptCounter(userId: string) {
    return this.db.$transaction(async (tx) => {
      const teacher = await tx.teacher.findUnique({ where: { userId } });
      if (!teacher) throw notFound('TEACHER_NOT_FOUND');
      if (
        teacher.priceStatus !== 'COUNTER_OFFER' ||
        teacher.counterTrialPrice == null ||
        teacher.counterRegularPrice == null
      ) {
        throw badRequest('COUNTER_OFFER_NOT_AVAILABLE');
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
          before: {
            status: teacher.priceStatus,
            counterTrialPrice: teacher.counterTrialPrice,
            counterRegularPrice: teacher.counterRegularPrice,
          },
          after: {
            status: 'SUBMITTED',
            proposedTrialPrice: teacher.counterTrialPrice,
            proposedRegularPrice: teacher.counterRegularPrice,
          },
        },
      });
      return updated;
    });
  }

  async adminList(page: number, limit: number, status?: PriceStatus, search = '') {
    const where = {
      ...(status && { priceStatus: status }),
      ...(search && {
        OR: [
          { nameFa: { contains: search, mode: 'insensitive' as const } },
          { nameEn: { contains: search, mode: 'insensitive' as const } },
          { user: { phone: { contains: search } } },
        ],
      }),
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
    input: {
      action: 'start_review' | 'counter' | 'reject' | 'recommend_approval' | 'approve';
      counterTrialPrice?: number;
      counterRegularPrice?: number;
      note?: string;
    },
  ) {
    return this.db.$transaction(async (tx) => {
      const teacher = await tx.teacher.findUnique({ where: { id: teacherId } });
      if (!teacher) throw notFound('TEACHER_NOT_FOUND');
      if (teacher.proposedTrialPrice == null || teacher.proposedRegularPrice == null) {
        throw badRequest('PRICE_PROPOSAL_MISSING');
      }

      let status: PriceStatus;
      const data: Record<string, unknown> = {
        priceReviewedById: actorId,
        priceReviewedAt: new Date(),
        priceReviewNote: input.note,
      };
      if (input.action === 'start_review' || input.action === 'recommend_approval') {
        status = 'UNDER_REVIEW';
      } else if (input.action === 'counter') {
        if (input.counterTrialPrice == null || input.counterRegularPrice == null) {
          throw badRequest('COUNTER_PRICE_REQUIRED');
        }
        this.validatePrices(input.counterTrialPrice, input.counterRegularPrice);
        status = 'COUNTER_OFFER';
        data.counterTrialPrice = input.counterTrialPrice;
        data.counterRegularPrice = input.counterRegularPrice;
      } else if (input.action === 'reject') {
        if (!input.note?.trim()) throw badRequest('PRICE_REJECTION_NOTE_REQUIRED');
        status = 'REJECTED';
      } else {
        if (!actorRoles.includes('ADMIN')) throw forbidden('FINAL_PRICE_ADMIN_ONLY');
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
      await tx.auditLog.create({
        data: {
          actorId,
          action: `teacher.price.${input.action}`,
          entity: 'Teacher',
          entityId: teacherId,
          before: { status: teacher.priceStatus },
          after: { status, note: input.note },
        },
      });
      await tx.notification.create({
        data: {
          userId: teacher.userId,
          type: 'TEACHER_PRICE_REVIEWED',
          titleFa: 'وضعیت قیمت‌گذاری به‌روزرسانی شد',
          titleEn: 'Pricing status updated',
          bodyFa:
            status === 'APPROVED'
              ? 'قیمت‌های شما تأیید و در پروفایل عمومی منتشر شد.'
              : `وضعیت قیمت‌گذاری شما به ${status} تغییر کرد.${input.note ? ` توضیح: ${input.note}` : ''}`,
          bodyEn:
            status === 'APPROVED'
              ? 'Your prices were approved and published on your public profile.'
              : `Your pricing status changed to ${status}.${input.note ? ` Note: ${input.note}` : ''}`,
          data: { teacherId, status, path: '/teacher-panel/pricing' },
        },
      });
      return updated;
    });
  }
}
