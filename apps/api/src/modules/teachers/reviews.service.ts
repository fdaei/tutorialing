import { Injectable } from '@nestjs/common';
import { Prisma, ReviewStatus } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { badRequest, conflict, forbidden, notFound } from '../../common/errors';

@Injectable()
export class ReviewsService {
  constructor(private readonly db: PrismaService) {}

  private async refreshTeacherRating(teacherId: string, tx: PrismaService | Prisma.TransactionClient = this.db) {
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
