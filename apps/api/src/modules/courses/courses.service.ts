import { Injectable } from '@nestjs/common';
import { PrismaService, type DbClient } from '../../infrastructure/database/prisma.service';
import { badRequest, conflict, forbidden, notFound } from '../../common';

@Injectable()
export class CoursesService {
  constructor(private readonly db: PrismaService) {}

  list() {
    return this.db.course.findMany({
      where: { published: true },
      orderBy: [{ rating: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async detail(slug: string) {
    const course = await this.db.course.findFirst({
      where: { OR: [{ id: slug }, { slug }], published: true },
      include: {
        reviews: {
          where: { published: true },
          include: { user: { select: { id: true, name: true, avatarKey: true } } },
          orderBy: { createdAt: 'desc' },
          take: 30,
        },
      },
    });
    if (!course) throw notFound('COURSE_NOT_FOUND');
    const grouped = await this.db.courseReview.groupBy({
      by: ['rating'],
      where: { courseId: course.id, published: true },
      _count: { _all: true },
    });
    return { ...course, distribution: Object.fromEntries(grouped.map((row) => [row.rating, row._count._all])) };
  }

  async mine(userId: string, courseId: string) {
    return this.db.courseReview.findUnique({ where: { userId_courseId: { userId, courseId } } });
  }

  async eligibility(userId: string, courseId: string) {
    const [enrollment, review] = await this.db.$transaction([
      this.db.courseEnrollment.findUnique({
        where: { userId_courseId: { userId, courseId } },
        select: { id: true },
      }),
      this.db.courseReview.findUnique({ where: { userId_courseId: { userId, courseId } } }),
    ]);
    return { eligible: Boolean(enrollment), review };
  }

  private reviewInput(rating: number, comment: string) {
    const normalized = comment.trim();
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw badRequest('REVIEW_RATING_INVALID');
    if (normalized.length < 10 || normalized.length > 3_000) throw badRequest('REVIEW_COMMENT_INVALID');
    return normalized;
  }

  private async refresh(courseId: string, tx: DbClient) {
    const aggregate = await tx.courseReview.aggregate({
      where: { courseId, published: true },
      _avg: { rating: true },
      _count: { _all: true },
    });
    await tx.course.update({
      where: { id: courseId },
      data: {
        rating: Math.round((aggregate._avg.rating ?? 0) * 10) / 10,
        reviewsCount: aggregate._count._all,
      },
    });
  }

  async create(userId: string, courseId: string, rating: number, comment: string) {
    const normalizedComment = this.reviewInput(rating, comment);
    const enrollment = await this.db.courseEnrollment.findUnique({ where: { userId_courseId: { userId, courseId } } });
    if (!enrollment) throw forbidden('COURSE_REVIEW_REQUIRES_ENROLLMENT');
    if (await this.mine(userId, courseId)) throw conflict('COURSE_REVIEW_ALREADY_EXISTS');
    return this.db.$transaction(async (tx) => {
      const review = await tx.courseReview.create({
        data: {
          userId,
          courseId,
          rating,
          comment: normalizedComment,
          isVerified: true,
        },
      });
      await this.refresh(courseId, tx);
      return review;
    });
  }

  async update(userId: string, id: string, rating: number, comment: string) {
    const normalizedComment = this.reviewInput(rating, comment);
    const current = await this.db.courseReview.findUnique({ where: { id } });
    if (!current || current.userId !== userId) throw notFound('COURSE_REVIEW_NOT_FOUND');
    return this.db.$transaction(async (tx) => {
      const review = await tx.courseReview.update({ where: { id }, data: { rating, comment: normalizedComment } });
      await this.refresh(current.courseId, tx);
      return review;
    });
  }

  async remove(userId: string, id: string) {
    const current = await this.db.courseReview.findUnique({ where: { id } });
    if (!current || current.userId !== userId) throw notFound('COURSE_REVIEW_NOT_FOUND');
    await this.db.$transaction(async (tx) => {
      await tx.courseReview.delete({ where: { id } });
      await this.refresh(current.courseId, tx);
    });
    return { deleted: true };
  }

  adminList() {
    return this.db.courseReview.findMany({
      include: {
        user: { select: { id: true, name: true, phone: true } },
        course: { select: { id: true, slug: true, titleFa: true, titleEn: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async setPublished(id: string, published: boolean) {
    const current = await this.db.courseReview.findUnique({ where: { id } });
    if (!current) throw notFound('COURSE_REVIEW_NOT_FOUND');
    return this.db.$transaction(async (tx) => {
      const review = await tx.courseReview.update({ where: { id }, data: { published } });
      await this.refresh(current.courseId, tx);
      return review;
    });
  }
}
