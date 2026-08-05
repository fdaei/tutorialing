import { Injectable } from '@nestjs/common';
import { ReviewStatus } from '@prisma/client';
import { PrismaService, type DbClient, type Tx } from '../../prisma.service';
import { badRequest, conflict, forbidden, notFound } from '../../common';
import { SettingsService } from '../../common';

@Injectable()
export class ReviewsService {
  constructor(private readonly db: PrismaService, private readonly settings: SettingsService) {}

  private async refreshTeacherRating(teacherId: string, tx: DbClient = this.db) {
    const approved = await tx.review.aggregate({
      where: { teacherId, moderationStatus: 'APPROVED', published: true },
      _avg: { rating: true },
      _count: { _all: true },
    });
    await tx.teacher.update({
      where: { id: teacherId },
      data: { rating: Math.round((approved._avg.rating ?? 0) * 10) / 10, reviewsCount: approved._count._all },
    });
  }

  /**
   * Deactivates a teacher who has accumulated more than the allowed number of
   * published 1-star reviews.
   *
   * Only moderator-approved, published reviews count, so the rule cannot be
   * weaponised by submitting unmoderated 1-star reviews. The threshold is a
   * setting rather than a literal so support can tune it without a deploy.
   * Deactivation sets the teacher back to REJECTED, which is what every public
   * query already filters on — the profile leaves search and becomes unbookable
   * immediately, while the record and its history are preserved for appeal.
   */
  private async enforceOneStarLimit(tx: DbClient, teacherId: string, actorId: string) {
    const threshold = await this.settings.numeric('reviews.autoDeactivateOneStarCount', 5, 1_000, tx as Tx);
    const oneStars = await tx.review.count({
      where: { teacherId, rating: 1, moderationStatus: 'APPROVED', published: true },
    });
    if (oneStars <= threshold) return;
    const teacher = await tx.teacher.findUnique({ where: { id: teacherId } });
    if (!teacher || teacher.status === 'REJECTED') return;
    await tx.teacher.update({ where: { id: teacherId }, data: { status: 'REJECTED' } });
    await tx.auditLog.create({
      data: {
        actorId,
        action: 'teacher.auto_deactivated',
        entity: 'Teacher',
        entityId: teacherId,
        before: { status: teacher.status },
        after: { status: 'REJECTED', reason: 'one_star_review_threshold', oneStarCount: oneStars, threshold },
      },
    });
    await tx.notification.create({
      data: {
        userId: teacher.userId,
        type: 'TEACHER_AUTO_DEACTIVATED',
        titleFa: 'پروفایل شما غیرفعال شد',
        titleEn: 'Your profile was deactivated',
        bodyFa: `پروفایل شما به دلیل دریافت بیش از ${threshold} نظر یک‌ستاره تأییدشده غیرفعال شد و از نتایج جستجو حذف شده است. برای بررسی مجدد با پشتیبانی تماس بگیرید.`,
        bodyEn: `Your profile was deactivated after receiving more than ${threshold} approved one-star reviews and has been removed from search. Contact support to request a review.`,
        data: { teacherId, oneStarCount: oneStars, threshold },
      },
    });
  }

  async create(studentId: string, bookingId: string, rating: number, comment?: string) {
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw badRequest('REVIEW_RATING_INVALID', 'امتیاز باید عددی بین ۱ تا ۵ باشد.', 'Rating must be a whole number from 1 to 5.', {
        rating: { fa: 'یکی از ستاره‌های ۱ تا ۵ را انتخاب کنید.', en: 'Select one to five stars.' },
      });
    }
    const booking = await this.db.booking.findUnique({ where: { id: bookingId }, include: { review: true } });
    if (!booking || booking.studentId !== studentId) throw notFound('BOOKING_NOT_FOUND', 'کلاس موردنظر پیدا نشد.', 'The booking was not found.');
    if (booking.review) throw conflict('REVIEW_ALREADY_EXISTS', 'برای این کلاس قبلاً نظر ثبت شده است.', 'A review has already been submitted for this booking.');
    if (booking.status !== 'COMPLETED' || !booking.attendanceTeacher || booking.attendanceStudent === false) {
      throw forbidden('REVIEW_REQUIRES_COMPLETED_CLASS', 'فقط پس از برگزاری و تکمیل موفق کلاس می‌توانید نظر ثبت کنید.', 'You can review a teacher only after a successfully completed class.');
    }
    return this.db.$transaction(async (tx) => {
      const review = await tx.review.create({
        data: { teacherId: booking.teacherId, studentId, bookingId, rating, comment: comment?.trim() || null, moderationStatus: 'PENDING', published: false },
        include: { teacher: { select: { nameFa: true, nameEn: true } } },
      });
      await tx.auditLog.create({ data: { actorId: studentId, action: 'review.submitted', entity: 'Review', entityId: review.id, after: { bookingId, rating } } });
      return review;
    });
  }

  async adminList(page: number, limit: number, status?: ReviewStatus, search = '') {
    const where = {
      ...(status && { moderationStatus: status }),
      ...(search && { OR: [{ comment: { contains: search, mode: 'insensitive' as const } }, { teacher: { OR: [{ nameFa: { contains: search, mode: 'insensitive' as const } }, { nameEn: { contains: search, mode: 'insensitive' as const } }] } }, { student: { OR: [{ name: { contains: search, mode: 'insensitive' as const } }, { phone: { contains: search } }] } }] }),
    };
    const [data, total] = await this.db.$transaction([
      this.db.review.findMany({ where, skip: (page - 1) * limit, take: limit, include: { student: { select: { name: true, phone: true } }, teacher: { select: { nameFa: true, nameEn: true, slug: true } }, booking: { select: { startsAt: true, endsAt: true, status: true } } }, orderBy: { createdAt: 'desc' } }),
      this.db.review.count({ where }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async moderate(actorId: string, reviewId: string, status: 'APPROVED' | 'REJECTED' | 'NEEDS_REVISION', note?: string) {
    if (status !== 'APPROVED' && !note?.trim()) throw badRequest('REVIEW_MODERATION_NOTE_REQUIRED', 'برای رد یا نیاز به اصلاح، دلیل را بنویسید.', 'Provide a reason when rejecting or requesting revision.');
    return this.db.$transaction(async (tx) => {
      const before = await tx.review.findUnique({ where: { id: reviewId } });
      if (!before) throw notFound('REVIEW_NOT_FOUND', 'نظر پیدا نشد.', 'Review not found.');
      const review = await tx.review.update({
        where: { id: reviewId },
        data: { moderationStatus: status, published: status === 'APPROVED', moderatedById: actorId, moderatedAt: new Date(), rejectionReason: status === 'APPROVED' ? null : note },
      });
      await this.refreshTeacherRating(review.teacherId, tx);
      if (status === 'APPROVED' && review.rating === 1) await this.enforceOneStarLimit(tx, review.teacherId, actorId);
      await tx.notification.create({
        data: {
          userId: review.studentId,
          type: 'REVIEW_MODERATED',
          titleFa: 'وضعیت نظر شما مشخص شد',
          titleEn: 'Your review was moderated',
          bodyFa: status === 'APPROVED' ? 'نظر شما تأیید و در پروفایل مدرس منتشر شد.' : `نظر شما ${status === 'REJECTED' ? 'رد شد' : 'نیاز به اصلاح دارد'}. ${note ?? ''}`,
          bodyEn: status === 'APPROVED' ? 'Your review was approved and published.' : `Your review was marked ${status}. ${note ?? ''}`,
          data: { reviewId, status },
        },
      });
      await tx.auditLog.create({ data: { actorId, action: 'review.moderated', entity: 'Review', entityId: reviewId, before: { status: before.moderationStatus }, after: { status, note } } });
      return review;
    });
  }

  async reply(teacherUserId: string, reviewId: string, response: string) {
    const review = await this.db.review.findUnique({ where: { id: reviewId }, include: { teacher: true } });
    if (!review) throw notFound('REVIEW_NOT_FOUND', 'نظر پیدا نشد.', 'Review not found.');
    if (review.teacher.userId !== teacherUserId) throw forbidden('REVIEW_REPLY_FORBIDDEN', 'فقط مدرس همین کلاس می‌تواند به نظر پاسخ دهد.', 'Only the reviewed teacher can reply.');
    if (review.moderationStatus !== 'APPROVED') throw badRequest('REVIEW_NOT_PUBLISHED', 'فقط به نظر تأییدشده و منتشرشده می‌توان پاسخ داد.', 'Only approved and published reviews can be answered.');
    return this.db.review.update({ where: { id: reviewId }, data: { teacherResponse: response.trim(), respondedAt: new Date() } });
  }
}
