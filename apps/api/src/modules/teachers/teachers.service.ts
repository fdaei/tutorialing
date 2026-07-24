import { Injectable } from '@nestjs/common';
import { Prisma, TeacherStatus } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { TeachersRepository } from './teachers.repository';
import { AuditService } from '../../common/audit.service';
import { badRequest, notFound } from '../../common/errors';

export type TeacherApplicationInput = {
  nameFa: string;
  nameEn: string;
  bioFa: string;
  bioEn: string;
  specialties: string[];
  languageIds: string[];
  levels?: string[];
  experienceYears: number;
  gender?: string;
  lessonDuration?: number;
  trialDuration?: number;
  breakMinutes?: number;
};

@Injectable()
export class TeachersService {
  constructor(private readonly db: PrismaService, private readonly audit: AuditService) {}

  async directory(query: {
    page: number;
    limit: number;
    search?: string;
    skill?: string;
    language?: string;
    minBand?: number;
    maxPrice?: number;
    sort?: string;
  }) {
    const where: Prisma.TeacherWhereInput = {
      status: 'APPROVED',
      approvedTrialPrice: { not: null },
      approvedRegularPrice: { not: null },
      ...(query.search && {
        OR: [
          { nameFa: { contains: query.search, mode: 'insensitive' } },
          { nameEn: { contains: query.search, mode: 'insensitive' } },
          { bioFa: { contains: query.search, mode: 'insensitive' } },
          { bioEn: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
      ...(query.skill && {
        OR: [
          { specialties: { has: query.skill } },
          { languageLinks: { some: { active: true, specialties: { has: query.skill } } } },
        ],
      }),
      ...(query.language && {
        languageLinks: {
          some: {
            active: true,
            language: { active: true, OR: [{ id: query.language }, { code: query.language }] },
          },
        },
      }),
      ...(query.minBand && { targetBands: { has: query.minBand } }),
      ...(query.maxPrice && { approvedTrialPrice: { lte: query.maxPrice } }),
    };
    const orderBy: Prisma.TeacherOrderByWithRelationInput = query.sort === 'price_asc'
      ? { approvedTrialPrice: 'asc' }
      : query.sort === 'rating'
        ? { rating: 'desc' }
        : { approvedAt: 'desc' };
    const [data, total] = await this.db.$transaction([
      this.db.teacher.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy,
        select: this.publicSelect(),
      }),
      this.db.teacher.count({ where }),
    ]);
    return { data, total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) };
  }

  async profile(slug: string) {
    const teacher = await this.db.teacher.findFirst({
      where: { OR: [{ slug }, { id: slug }], status: 'APPROVED', approvedTrialPrice: { not: null }, approvedRegularPrice: { not: null } },
      select: {
        ...this.publicSelect(),
        experienceYears: true,
        lessonDuration: true,
        trialDuration: true,
        breakMinutes: true,
        policy: { select: { titleFa: true, titleEn: true, rules: true } },
        packages: { where: { active: true, approvalStatus: 'APPROVED' }, orderBy: { price: 'asc' } },
        reviews: {
          where: { published: true, moderationStatus: 'APPROVED' },
          select: {
            id: true,
            rating: true,
            comment: true,
            teacherResponse: true,
            respondedAt: true,
            createdAt: true,
            student: { select: { name: true, avatarKey: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });
    if (!teacher) return null;
    const [successfulClasses, students] = await this.db.$transaction([
      this.db.booking.count({
        where: {
          teacherId: teacher.id,
          status: 'COMPLETED',
          attendanceTeacher: true,
          attendanceStudent: { not: false },
          classRecord: { completedAt: { not: null } },
        },
      }),
      this.db.booking.findMany({
        where: { teacherId: teacher.id, status: 'COMPLETED', attendanceTeacher: true, attendanceStudent: { not: false } },
        distinct: ['studentId'],
        select: { studentId: true },
      }),
    ]);
    return { ...teacher, successfulClasses, studentsCount: students.length };
  }

  private publicSelect() {
    return {
      id: true,
      slug: true,
      nameFa: true,
      nameEn: true,
      bioFa: true,
      bioEn: true,
      rating: true,
      reviewsCount: true,
      trialPrice: true,
      regularPrice: true,
      approvedTrialPrice: true,
      approvedRegularPrice: true,
      trialDuration: true,
      lessonDuration: true,
      specialties: true,
      targetBands: true,
      introVideoKey: true,
      approvedAt: true,
      languageLinks: {
        where: { active: true, language: { active: true } },
        select: {
          levels: true,
          specialties: true,
          language: { select: { id: true, code: true, nameFa: true, nameEn: true, nativeName: true, flag: true, direction: true, proficiencySystem: true } },
        },
        orderBy: { language: { order: 'asc' as const } },
      },
    } as const;
  }

  async application(userId: string, input: TeacherApplicationInput) {
    const languageIds = [...new Set(input.languageIds)];
    if (!languageIds.length) {
      throw badRequest('TEACHER_LANGUAGE_REQUIRED', 'حداقل یک زبان آموزشی انتخاب کنید.', 'Select at least one teaching language.', {
        languageIds: { fa: 'زبان‌هایی را که تدریس می‌کنید از فهرست انتخاب کنید.', en: 'Choose the languages you teach from the list.' },
      });
    }
    const languages = await this.db.language.findMany({ where: { id: { in: languageIds }, active: true } });
    if (languages.length !== languageIds.length) throw badRequest('TEACHER_LANGUAGE_INVALID', 'یک یا چند زبان انتخاب‌شده معتبر یا فعال نیست.', 'One or more selected languages are invalid or inactive.');
    const slugBase = input.nameEn.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'teacher';
    const slug = `${slugBase}-${userId.slice(-5)}`;
    return this.db.$transaction(async (tx) => {
      const teacher = await tx.teacher.upsert({
        where: { userId },
        update: {
          nameFa: input.nameFa,
          nameEn: input.nameEn,
          bioFa: input.bioFa,
          bioEn: input.bioEn,
          specialties: input.specialties,
          experienceYears: input.experienceYears,
          gender: input.gender,
          lessonDuration: input.lessonDuration ?? undefined,
          trialDuration: input.trialDuration ?? undefined,
          breakMinutes: input.breakMinutes ?? undefined,
        },
        create: {
          userId,
          slug,
          nameFa: input.nameFa,
          nameEn: input.nameEn,
          bioFa: input.bioFa,
          bioEn: input.bioEn,
          specialties: input.specialties,
          languages: languages.map((language) => language.nameEn),
          experienceYears: input.experienceYears,
          gender: input.gender,
          lessonDuration: input.lessonDuration ?? 60,
          trialDuration: input.trialDuration ?? 30,
          breakMinutes: input.breakMinutes ?? 15,
          targetBands: [],
        },
      });
      await tx.teacherLanguage.deleteMany({ where: { teacherId: teacher.id, languageId: { notIn: languageIds } } });
      for (const languageId of languageIds) {
        await tx.teacherLanguage.upsert({
          where: { teacherId_languageId: { teacherId: teacher.id, languageId } },
          create: { teacherId: teacher.id, languageId, levels: input.levels ?? [], specialties: input.specialties },
          update: { active: true, levels: input.levels ?? [], specialties: input.specialties },
        });
      }
      await tx.userRole.upsert({ where: { userId_role: { userId, role: 'TEACHER' } }, create: { userId, role: 'TEACHER' }, update: {} });
      return tx.teacher.findUniqueOrThrow({ where: { id: teacher.id }, include: { languageLinks: { include: { language: true } }, verificationItems: true } });
    });
  }

  async mine(userId: string) {
    const teacher = await this.db.teacher.findUnique({
      where: { userId },
      include: {
        languageLinks: { include: { language: true }, orderBy: { language: { order: 'asc' } } },
        verificationItems: { include: { file: true }, orderBy: { createdAt: 'desc' } },
        verificationHistory: { orderBy: { createdAt: 'desc' } },
        priceHistory: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!teacher?.introVideoKey) return teacher;
    const file = await this.db.storedFile.findFirst({ where: { ownerId: userId, key: teacher.introVideoKey, status: 'SAFE' }, select: { id: true } });
    return { ...teacher, introVideoFileId: file?.id };
  }

  async submit(userId: string) {
    const teacher = await this.db.teacher.findUnique({ where: { userId }, include: { verificationItems: true, languageLinks: true } });
    if (!teacher) throw notFound('TEACHER_APPLICATION_NOT_FOUND', 'درخواست مدرس پیدا نشد.', 'Teacher application not found.');
    if (!['DRAFT', 'REJECTED'].includes(teacher.status)) {
      throw badRequest('TEACHER_APPLICATION_NOT_SUBMITTABLE', 'این درخواست در وضعیت فعلی قابل ارسال نیست.', 'The application cannot be submitted in its current state.');
    }
    const approvedKinds = new Set(teacher.verificationItems.filter((item) => ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED'].includes(item.status)).map((item) => item.kind.toLowerCase()));
    if (!approvedKinds.has('identity') || !approvedKinds.has('certificate')) {
      throw badRequest(
        'TEACHER_DOCUMENTS_REQUIRED',
        'مدرک هویتی و مدرک آموزشی را بارگذاری و ارسال کنید.',
        'Upload and submit both identity and teaching certificate documents.',
      );
    }
    if (!teacher.languageLinks.length) throw badRequest('TEACHER_LANGUAGE_REQUIRED', 'حداقل یک زبان آموزشی انتخاب کنید.', 'Select at least one teaching language.');
    return this.transition(teacher.id, 'SUBMITTED', userId);
  }

  async transition(id: string, to: TeacherStatus, actorId: string, note?: string) {
    return this.db.$transaction(async (tx) => {
      const teacher = await tx.teacher.findUnique({ where: { id } });
      if (!teacher) throw notFound('TEACHER_NOT_FOUND', 'مدرس پیدا نشد.', 'Teacher not found.');
      const valid: Record<TeacherStatus, TeacherStatus[]> = {
        DRAFT: ['SUBMITTED'],
        REJECTED: ['SUBMITTED'],
        SUBMITTED: ['DOCUMENT_REVIEW', 'REJECTED'],
        DOCUMENT_REVIEW: ['INTERVIEW', 'REJECTED'],
        INTERVIEW: ['DEMO_REVIEW', 'REJECTED'],
        DEMO_REVIEW: ['APPROVED', 'REJECTED'],
        APPROVED: [],
      };
      if (!valid[teacher.status].includes(to)) {
        throw badRequest(
          'TEACHER_STATUS_TRANSITION_INVALID',
          `تغییر وضعیت از ${teacher.status} به ${to} مجاز نیست.`,
          `Changing teacher status from ${teacher.status} to ${to} is not allowed.`,
        );
      }
      const output = await tx.teacher.update({
        where: { id },
        data: {
          status: to,
          ...(to === 'SUBMITTED' && { submittedAt: new Date() }),
          ...(to === 'APPROVED' && { approvedAt: new Date() }),
        },
      });
      await tx.verificationHistory.create({ data: { teacherId: id, fromStatus: teacher.status, toStatus: to, actorId, note } });
      await tx.auditLog.create({ data: { actorId, action: 'teacher.status.changed', entity: 'Teacher', entityId: id, before: { status: teacher.status }, after: { status: to, note } } });
      return output;
    });
  }
}
