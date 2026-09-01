import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService, type DbClient } from '../../infrastructure/database/prisma.service';
import { badRequest, conflict, forbidden, notFound } from '../../common';
import type { AuthUser } from '../../common';
import type { CourseChapterDto, CourseLessonDto } from './dto/course-curriculum.dto';
import type { AdminCourseDto } from './dto/admin-course.dto';

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
        chapters: {
          where: { published: true },
          orderBy: { order: 'asc' },
          include: {
            lessons: {
              where: { published: true },
              orderBy: { order: 'asc' },
              select: {
                id: true,
                titleFa: true,
                titleEn: true,
                descriptionFa: true,
                descriptionEn: true,
                type: true,
                durationSeconds: true,
                order: true,
                preview: true,
              },
            },
          },
        },
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

  async learning(userId: string) {
    const enrollments = await this.db.courseEnrollment.findMany({
      where: { userId, course: { published: true } },
      orderBy: { createdAt: 'desc' },
      include: {
        course: {
          select: {
            id: true,
            slug: true,
            titleFa: true,
            titleEn: true,
            image: true,
            level: true,
            language: true,
            lessonsCount: true,
            chapters: {
              where: { published: true },
              select: { lessons: { where: { published: true }, select: { id: true } } },
            },
          },
        },
        lastLesson: { select: { id: true, titleFa: true, titleEn: true } },
        progress: { select: { lessonId: true, completedAt: true, lastViewedAt: true } },
      },
    });
    return enrollments.map((enrollment) => {
      const { chapters, ...course } = enrollment.course;
      const totalLessons = chapters.reduce((total, chapter) => total + chapter.lessons.length, 0);
      const completedLessons = enrollment.progress.filter((row) => row.completedAt).length;
      return {
        ...enrollment,
        course,
        totalLessons,
        completedLessons,
        progressPercent: totalLessons ? Math.min(100, Math.round((completedLessons / totalLessons) * 100)) : 0,
      };
    });
  }

  async player(userId: string, courseId: string) {
    const enrollment = await this.db.courseEnrollment.findFirst({
      where: { userId, course: { OR: [{ id: courseId }, { slug: courseId }], published: true } },
      include: {
        progress: true,
        course: {
          include: {
            chapters: {
              where: { published: true },
              orderBy: { order: 'asc' },
              include: {
                lessons: { where: { published: true }, orderBy: { order: 'asc' }, include: { attachments: true } },
              },
            },
          },
        },
      },
    });
    if (!enrollment) throw forbidden('COURSE_ENROLLMENT_REQUIRED');
    const lessons = enrollment.course.chapters.flatMap((chapter) => chapter.lessons);
    const completed = new Set(enrollment.progress.filter((row) => row.completedAt).map((row) => row.lessonId));
    return {
      enrollmentId: enrollment.id,
      completedAt: enrollment.completedAt,
      lastLessonId: enrollment.lastLessonId ?? lessons[0]?.id ?? null,
      completedLessons: completed.size,
      totalLessons: lessons.length,
      progressPercent: lessons.length ? Math.round((completed.size / lessons.length) * 100) : 0,
      progress: enrollment.progress,
      course: enrollment.course,
    };
  }

  async progress(
    userId: string,
    courseId: string,
    lessonId: string,
    input: { completed?: boolean; positionSeconds?: number },
  ) {
    const enrollment = await this.db.courseEnrollment.findFirst({
      where: { userId, course: { OR: [{ id: courseId }, { slug: courseId }], published: true } },
      select: { id: true, courseId: true },
    });
    if (!enrollment) throw forbidden('COURSE_ENROLLMENT_REQUIRED');
    const lesson = await this.db.courseLesson.findFirst({
      where: { id: lessonId, published: true, chapter: { courseId: enrollment.courseId, published: true } },
      select: { id: true, durationSeconds: true },
    });
    if (!lesson) throw notFound('COURSE_LESSON_NOT_FOUND');
    const positionSeconds =
      input.positionSeconds === undefined
        ? undefined
        : Math.max(0, Math.min(input.positionSeconds, Math.max(lesson.durationSeconds, 0)));
    return this.db.$transaction(async (tx) => {
      const updated = await tx.courseLessonProgress.upsert({
        where: { enrollmentId_lessonId: { enrollmentId: enrollment.id, lessonId } },
        create: {
          enrollmentId: enrollment.id,
          lessonId,
          positionSeconds: positionSeconds ?? 0,
          completedAt: input.completed ? new Date() : null,
        },
        update: {
          ...(positionSeconds !== undefined ? { positionSeconds } : {}),
          lastViewedAt: new Date(),
          ...(input.completed !== undefined ? { completedAt: input.completed ? new Date() : null } : {}),
        },
      });
      const [completedLessons, totalLessons] = await Promise.all([
        tx.courseLessonProgress.count({ where: { enrollmentId: enrollment.id, completedAt: { not: null } } }),
        tx.courseLesson.count({
          where: { chapter: { courseId: enrollment.courseId, published: true }, published: true },
        }),
      ]);
      const complete = totalLessons > 0 && completedLessons === totalLessons;
      await tx.courseEnrollment.update({
        where: { id: enrollment.id },
        data: { lastLessonId: lessonId, completedAt: complete ? new Date() : null },
      });
      return {
        progress: updated,
        completedLessons,
        totalLessons,
        progressPercent: totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0,
        courseCompleted: complete,
      };
    });
  }

  private async ownedCourse(user: AuthUser, courseId: string) {
    const course = await this.db.course.findFirst({
      where: { OR: [{ id: courseId }, { slug: courseId }] },
      select: { id: true, teacherId: true, teacher: { select: { userId: true } } },
    });
    if (!course) throw notFound('COURSE_NOT_FOUND');
    if (!user.roles.includes('ADMIN') && course.teacher?.userId !== user.id)
      throw forbidden('COURSE_OWNERSHIP_REQUIRED');
    return course;
  }

  async instructorCourses(user: AuthUser) {
    return this.db.course.findMany({
      where: user.roles.includes('ADMIN') ? {} : { teacher: { userId: user.id } },
      include: { _count: { select: { chapters: true, enrollments: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  adminCourses() {
    return this.db.course.findMany({
      include: {
        teacher: { select: { id: true, nameFa: true, nameEn: true, status: true } },
        _count: { select: { chapters: true, enrollments: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  courseInstructors() {
    return this.db.teacher.findMany({
      where: { status: 'APPROVED' },
      select: { id: true, nameFa: true, nameEn: true, slug: true },
      orderBy: { nameFa: 'asc' },
    });
  }

  private async courseWriteData(input: AdminCourseDto, courseId?: string) {
    const teacherId = input.teacherId?.trim() || null;
    const [duplicate, teacher, lessonsCount] = await Promise.all([
      this.db.course.findFirst({
        where: { slug: input.slug, ...(courseId ? { id: { not: courseId } } : {}) },
        select: { id: true },
      }),
      teacherId
        ? this.db.teacher.findFirst({
            where: { id: teacherId, status: 'APPROVED' },
            select: { id: true, nameFa: true },
          })
        : null,
      courseId
        ? this.db.courseLesson.count({
            where: { chapter: { courseId, published: true }, published: true },
          })
        : 0,
    ]);
    if (duplicate) throw conflict('COURSE_SLUG_ALREADY_EXISTS');
    if (teacherId && !teacher) throw badRequest('COURSE_INSTRUCTOR_INVALID');
    if (input.published && !teacher) throw badRequest('COURSE_PUBLISH_REQUIRES_INSTRUCTOR');
    if (input.published && !lessonsCount) throw badRequest('COURSE_PUBLISH_REQUIRES_LESSONS');
    return {
      slug: input.slug,
      titleFa: input.titleFa.trim(),
      titleEn: input.titleEn.trim(),
      descriptionFa: input.descriptionFa.trim(),
      descriptionEn: input.descriptionEn.trim(),
      language: input.language.trim(),
      level: input.level,
      teacherId,
      teacherName: teacher?.nameFa ?? 'تیم لینگواسپیک',
      price: input.price,
      image: input.image?.trim() || null,
      published: input.published,
      lessonsCount,
    };
  }

  async createCourse(input: AdminCourseDto) {
    const data = await this.courseWriteData(input);
    return this.db.course.create({ data });
  }

  async updateCourse(id: string, input: AdminCourseDto) {
    if (!(await this.db.course.findUnique({ where: { id }, select: { id: true } }))) throw notFound('COURSE_NOT_FOUND');
    const data = await this.courseWriteData(input, id);
    return this.db.course.update({ where: { id }, data });
  }

  async instructorCurriculum(user: AuthUser, courseId: string) {
    const course = await this.ownedCourse(user, courseId);
    return this.db.course.findUnique({
      where: { id: course.id },
      include: {
        chapters: {
          orderBy: { order: 'asc' },
          include: { lessons: { orderBy: { order: 'asc' }, include: { attachments: true } } },
        },
      },
    });
  }

  async createChapter(user: AuthUser, courseId: string, input: CourseChapterDto) {
    const course = await this.ownedCourse(user, courseId);
    return this.db.courseChapter.create({
      data: { ...input, published: input.published ?? false, courseId: course.id },
    });
  }

  async updateChapter(user: AuthUser, courseId: string, chapterId: string, input: CourseChapterDto) {
    const course = await this.ownedCourse(user, courseId);
    const chapter = await this.db.courseChapter.findFirst({
      where: { id: chapterId, courseId: course.id },
      select: { id: true },
    });
    if (!chapter) throw notFound('COURSE_CHAPTER_NOT_FOUND');
    return this.db.courseChapter.update({ where: { id: chapter.id }, data: input });
  }

  async removeChapter(user: AuthUser, courseId: string, chapterId: string) {
    const course = await this.ownedCourse(user, courseId);
    const chapter = await this.db.courseChapter.findFirst({
      where: { id: chapterId, courseId: course.id },
      select: { id: true },
    });
    if (!chapter) throw notFound('COURSE_CHAPTER_NOT_FOUND');
    await this.db.courseChapter.delete({ where: { id: chapter.id } });
    return { deleted: true };
  }

  async createLesson(user: AuthUser, courseId: string, chapterId: string, input: CourseLessonDto) {
    const course = await this.ownedCourse(user, courseId);
    const chapter = await this.db.courseChapter.findFirst({
      where: { id: chapterId, courseId: course.id },
      select: { id: true },
    });
    if (!chapter) throw notFound('COURSE_CHAPTER_NOT_FOUND');
    return this.db.courseLesson.create({
      data: {
        ...input,
        content: input.content as Prisma.InputJsonObject | undefined,
        published: input.published ?? false,
        preview: input.preview ?? false,
        chapterId: chapter.id,
      },
    });
  }

  async updateLesson(user: AuthUser, courseId: string, lessonId: string, input: CourseLessonDto) {
    const course = await this.ownedCourse(user, courseId);
    const lesson = await this.db.courseLesson.findFirst({
      where: { id: lessonId, chapter: { courseId: course.id } },
      select: { id: true },
    });
    if (!lesson) throw notFound('COURSE_LESSON_NOT_FOUND');
    return this.db.courseLesson.update({
      where: { id: lesson.id },
      data: { ...input, content: input.content as Prisma.InputJsonObject | undefined },
    });
  }

  async removeLesson(user: AuthUser, courseId: string, lessonId: string) {
    const course = await this.ownedCourse(user, courseId);
    const lesson = await this.db.courseLesson.findFirst({
      where: { id: lessonId, chapter: { courseId: course.id } },
      select: { id: true },
    });
    if (!lesson) throw notFound('COURSE_LESSON_NOT_FOUND');
    await this.db.courseLesson.delete({ where: { id: lesson.id } });
    return { deleted: true };
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
