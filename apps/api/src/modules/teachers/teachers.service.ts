import { Injectable } from '@nestjs/common';
import { Prisma, TeacherStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuditService } from '../../system/audit/audit.service';
import { badRequest, conflict, notFound, assertDomain, requireValue } from '../../common';
import { FilesService } from '../files/files.service';

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

export type AdminTeacherInput = TeacherApplicationInput & {
  phone: string;
  email?: string;
  trialPrice?: number;
  regularPrice?: number;
  approvedTrialPrice?: number | null;
  approvedRegularPrice?: number | null;
  targetBands?: number[];
  avatarFileId?: string | null;
  status?: TeacherStatus;
};

@Injectable()
export class TeachersService {
  constructor(
    private readonly db: PrismaService,
    private readonly audit: AuditService,
    private readonly files?: FilesService,
  ) {}

  async publicIntroVideo(slug: string) {
    const teacher = await this.db.teacher.findFirst({
      where: {
        OR: [{ id: slug }, { slug }],
        status: 'APPROVED',
        introVideoFile: {
          is: {
            status: 'SAFE',
            purpose: 'teacher-intro-video',
            mimeType: { in: ['video/mp4', 'video/webm', 'video/quicktime'] },
          },
        },
      },
      select: { introVideoFile: { select: { key: true, mimeType: true } } },
    });
    if (!teacher?.introVideoFile || !this.files) throw notFound('TEACHER_INTRO_VIDEO_NOT_FOUND');
    return {
      url: await this.files.createDownloadUrl(teacher.introVideoFile.key),
      mimeType: teacher.introVideoFile.mimeType,
    };
  }

  async adminApplications() {
    const applications = await this.db.teacher.findMany({
      where: { status: { notIn: ['DRAFT', 'APPROVED'] } },
      include: {
        user: { select: { phone: true, email: true } },
        verificationItems: { include: { file: true } },
        verificationHistory: { orderBy: { createdAt: 'desc' } },
        introVideoFile: { select: { id: true, key: true, originalName: true, mimeType: true, size: true } },
      },
      orderBy: { submittedAt: 'asc' },
    });
    return applications;
  }

  async adminList(page = 1, limit = 24, search = '', status = '') {
    const normalizedPage = Math.max(1, page);
    const normalizedLimit = Math.min(100, Math.max(1, limit));
    const where: Prisma.TeacherWhereInput = {
      ...(Object.values(TeacherStatus).includes(status as TeacherStatus) && {
        status: status as TeacherStatus,
      }),
      ...(search.trim() && {
        OR: [
          { nameFa: { contains: search.trim(), mode: 'insensitive' } },
          { nameEn: { contains: search.trim(), mode: 'insensitive' } },
          { user: { phone: { contains: search.trim() } } },
          { user: { email: { contains: search.trim(), mode: 'insensitive' } } },
        ],
      }),
    };
    const [rows, total] = await this.db.$transaction([
      this.db.teacher.findMany({
        where,
        skip: (normalizedPage - 1) * normalizedLimit,
        take: normalizedLimit,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          slug: true,
          nameFa: true,
          nameEn: true,
          status: true,
          rating: true,
          reviewsCount: true,
          experienceYears: true,
          specialties: true,
          approvedTrialPrice: true,
          approvedRegularPrice: true,
          user: { select: { phone: true, email: true, avatarKey: true } },
          languageLinks: {
            where: { active: true },
            select: { language: { select: { id: true, nameFa: true, nameEn: true, flag: true } } },
          },
        },
      }),
      this.db.teacher.count({ where }),
    ]);
    const data = await Promise.all(rows.map((row) => this.withAvatarUrl(row)));
    return {
      data,
      total,
      page: normalizedPage,
      limit: normalizedLimit,
      totalPages: Math.ceil(total / normalizedLimit),
    };
  }

  async adminDetail(id: string) {
    const teacher = await this.db.teacher.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, phone: true, email: true, avatarKey: true, locale: true } },
        languageLinks: {
          include: {
            language: { select: { id: true, code: true, nameFa: true, nameEn: true, nativeName: true, flag: true } },
          },
          orderBy: { language: { order: 'asc' } },
        },
        verificationItems: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            kind: true,
            status: true,
            note: true,
            createdAt: true,
            file: { select: { id: true, originalName: true, mimeType: true, size: true } },
          },
        },
        _count: {
          select: {
            bookings: true,
            reviews: true,
            courses: true,
            verificationItems: true,
            availabilityRules: true,
            learningPlans: true,
          },
        },
      },
    });
    if (!teacher) throw notFound('TEACHER_NOT_FOUND');
    return this.withAvatarUrl(teacher);
  }

  async adminCreate(actorId: string, input: AdminTeacherInput) {
    const normalized = await this.adminTeacherData(actorId, input);
    const existingUser = await this.db.user.findUnique({ where: { phone: input.phone.trim() }, select: { id: true } });
    assertDomain(!existingUser, () => conflict('USER_PHONE_EXISTS'));
    const slugBase =
      input.nameEn
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'teacher';

    const teacher = await this.db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          phone: input.phone.trim(),
          name: normalized.teacherData.nameFa,
          email: input.email?.trim() || undefined,
          locale: 'fa',
          profileComplete: true,
          ...(normalized.avatarKey !== undefined && { avatarKey: normalized.avatarKey }),
          roles: { create: { role: 'INSTRUCTOR' } },
        },
      });
      const created = await tx.teacher.create({
        data: {
          userId: user.id,
          slug: `${slugBase}-${user.id.slice(-5)}`,
          ...normalized.teacherData,
        },
      });
      await tx.teacherLanguage.createMany({
        data: normalized.languageIds.map((languageId) => ({
          teacherId: created.id,
          languageId,
          active: true,
          levels: normalized.levels,
          specialties: normalized.teacherData.specialties,
        })),
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'teacher.created',
          entity: 'Teacher',
          entityId: created.id,
          after: {
            phone: input.phone.trim(),
            nameFa: normalized.teacherData.nameFa,
            nameEn: normalized.teacherData.nameEn,
            status: normalized.teacherData.status,
          },
        },
      });
      return created;
    });
    return this.adminDetail(teacher.id);
  }

  async adminUpdate(actorId: string, id: string, input: Partial<AdminTeacherInput>) {
    const before = await this.db.teacher.findUnique({
      where: { id },
      include: { user: true, languageLinks: { include: { language: true } } },
    });
    if (!before) throw notFound('TEACHER_NOT_FOUND');
    if (input.phone && input.phone.trim() !== before.user.phone) {
      const existingUser = await this.db.user.findUnique({ where: { phone: input.phone.trim() }, select: { id: true } });
      assertDomain(!existingUser || existingUser.id === before.userId, () => conflict('USER_PHONE_EXISTS'));
    }
    const normalized = await this.adminTeacherData(actorId, {
      phone: input.phone ?? before.user.phone ?? '',
      email: input.email !== undefined ? input.email : before.user.email ?? undefined,
      nameFa: input.nameFa ?? before.nameFa,
      nameEn: input.nameEn ?? before.nameEn,
      bioFa: input.bioFa ?? before.bioFa,
      bioEn: input.bioEn ?? before.bioEn,
      specialties: input.specialties ?? before.specialties,
      languageIds: input.languageIds ?? before.languageLinks.map((link) => link.languageId),
      levels: input.levels ?? [...new Set(before.languageLinks.flatMap((link) => link.levels))],
      experienceYears: input.experienceYears ?? before.experienceYears,
      gender: input.gender !== undefined ? input.gender : before.gender ?? undefined,
      lessonDuration: input.lessonDuration ?? before.lessonDuration,
      trialDuration: input.trialDuration ?? before.trialDuration,
      breakMinutes: input.breakMinutes ?? before.breakMinutes,
      trialPrice: input.trialPrice ?? before.trialPrice,
      regularPrice: input.regularPrice ?? before.regularPrice,
      approvedTrialPrice:
        input.approvedTrialPrice !== undefined ? input.approvedTrialPrice : before.approvedTrialPrice,
      approvedRegularPrice:
        input.approvedRegularPrice !== undefined ? input.approvedRegularPrice : before.approvedRegularPrice,
      targetBands: input.targetBands ?? before.targetBands,
      avatarFileId: input.avatarFileId,
      status: input.status ?? before.status,
    });
    const teacher = await this.db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: before.userId },
        data: {
          ...(input.phone !== undefined && { phone: input.phone.trim() }),
          ...(input.email !== undefined && { email: input.email.trim() || null }),
          name: normalized.teacherData.nameFa,
          ...(normalized.avatarKey !== undefined && { avatarKey: normalized.avatarKey }),
        },
      });
      const updated = await tx.teacher.update({
        where: { id },
        data: normalized.teacherData,
      });
      if (input.languageIds !== undefined) {
        await tx.teacherLanguage.deleteMany({ where: { teacherId: id } });
        await tx.teacherLanguage.createMany({
          data: normalized.languageIds.map((languageId) => ({
            teacherId: id,
            languageId,
            active: true,
            levels: normalized.levels,
            specialties: normalized.teacherData.specialties,
          })),
        });
      }
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'teacher.updated',
          entity: 'Teacher',
          entityId: id,
          before: { nameFa: before.nameFa, nameEn: before.nameEn, status: before.status },
          after: {
            nameFa: normalized.teacherData.nameFa,
            nameEn: normalized.teacherData.nameEn,
            status: normalized.teacherData.status,
          },
        },
      });
      return updated;
    });
    return this.adminDetail(teacher.id);
  }

  private async adminTeacherData(ownerId: string, input: AdminTeacherInput) {
    const languageIds = [...new Set(input.languageIds)];
    if (!languageIds.length) throw badRequest('TEACHER_LANGUAGE_REQUIRED');
    const languages = await this.db.language.findMany({
      where: { id: { in: languageIds }, active: true },
      select: { id: true, nameEn: true },
    });
    if (languages.length !== languageIds.length) throw badRequest('TEACHER_LANGUAGE_INVALID');
    let avatarKey: string | null | undefined;
    if (input.avatarFileId !== undefined) {
      if (!input.avatarFileId) avatarKey = null;
      else {
        if (!this.files) throw badRequest('FILE_NOT_FOUND');
        avatarKey = (await this.files.ownedSafeImage(ownerId, input.avatarFileId, 'teacher-avatar')).key;
      }
    }
    return {
      teacherData: {
        nameFa: input.nameFa.trim(),
        nameEn: input.nameEn.trim(),
        bioFa: input.bioFa.trim(),
        bioEn: input.bioEn.trim(),
        specialties: input.specialties.map((item) => item.trim()).filter(Boolean),
        languages: languages.map((language) => language.nameEn),
        experienceYears: input.experienceYears,
        gender: input.gender?.trim() || null,
        lessonDuration: input.lessonDuration ?? 60,
        trialDuration: input.trialDuration ?? 30,
        breakMinutes: input.breakMinutes ?? 0,
        trialPrice: input.trialPrice ?? 0,
        regularPrice: input.regularPrice ?? 0,
        approvedTrialPrice: input.approvedTrialPrice ?? null,
        approvedRegularPrice: input.approvedRegularPrice ?? null,
        targetBands: input.targetBands ?? [],
        status: input.status ?? TeacherStatus.DRAFT,
      },
      languageIds,
      levels: input.levels ?? [],
      ...(avatarKey !== undefined && { avatarKey }),
    };
  }

  private async withAvatarUrl<T extends { user: { avatarKey: string | null } }>(teacher: T) {
    const avatarUrl = teacher.user.avatarKey && this.files
      ? await this.files.createDownloadUrl(teacher.user.avatarKey)
      : null;
    return { ...teacher, avatarUrl };
  }

  async directory(query: {
    page: number;
    limit: number;
    search?: string;
    skill?: string;
    language?: string;
    minBand?: number;
    maxPrice?: number;
    minRating?: number;
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
      ...(query.minRating && { rating: { gte: query.minRating } }),
    };
    const orderBy: Prisma.TeacherOrderByWithRelationInput =
      query.sort === 'price_asc'
        ? { approvedTrialPrice: 'asc' }
        : query.sort === 'rating'
          ? { rating: 'desc' }
          : query.sort === 'reviews'
            ? { reviewsCount: 'desc' }
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
      where: {
        OR: [{ slug }, { id: slug }],
        status: 'APPROVED',
        approvedTrialPrice: { not: null },
        approvedRegularPrice: { not: null },
      },
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
        where: {
          teacherId: teacher.id,
          status: 'COMPLETED',
          attendanceTeacher: true,
          attendanceStudent: { not: false },
        },
        distinct: ['studentId'],
        select: { studentId: true },
      }),
    ]);
    const distributionRows = await this.db.review.groupBy({
      by: ['rating'],
      where: { teacherId: teacher.id, published: true, moderationStatus: 'APPROVED' },
      orderBy: { rating: 'asc' },
      _count: { rating: true },
    });
    const distribution = Object.fromEntries(distributionRows.map((row) => [row.rating, row._count.rating]));
    return { ...teacher, successfulClasses, studentsCount: students.length, distribution };
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
          language: {
            select: {
              id: true,
              code: true,
              nameFa: true,
              nameEn: true,
              nativeName: true,
              flag: true,
              direction: true,
              proficiencySystem: true,
            },
          },
        },
        orderBy: { language: { order: 'asc' as const } },
      },
    } as const;
  }

  async application(userId: string, input: TeacherApplicationInput) {
    const languageIds = [...new Set(input.languageIds)];
    if (!languageIds.length) {
      throw badRequest('TEACHER_LANGUAGE_REQUIRED');
    }
    const languages = await this.db.language.findMany({ where: { id: { in: languageIds }, active: true } });
    if (languages.length !== languageIds.length) throw badRequest('TEACHER_LANGUAGE_INVALID');
    const slugBase =
      input.nameEn
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'teacher';
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
      // The application payload is a complete replacement. Rebuilding the
      // small join set uses two statements regardless of the language count,
      // instead of one upsert per item.
      await tx.teacherLanguage.deleteMany({ where: { teacherId: teacher.id } });
      await tx.teacherLanguage.createMany({
        data: languageIds.map((languageId) => ({
          teacherId: teacher.id,
          languageId,
          active: true,
          levels: input.levels ?? [],
          specialties: input.specialties,
        })),
      });
      await tx.userRole.upsert({
        where: { userId_role: { userId, role: 'INSTRUCTOR' } },
        create: { userId, role: 'INSTRUCTOR' },
        update: {},
      });
      return tx.teacher.findUniqueOrThrow({
        where: { id: teacher.id },
        include: { languageLinks: { include: { language: true } }, verificationItems: true },
      });
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
        introVideoFile: { select: { id: true } },
      },
    });
    return teacher;
  }

  async submit(userId: string) {
    const teacher = await this.db.teacher.findUnique({
      where: { userId },
      include: { verificationItems: true, languageLinks: true },
    });
    if (!teacher) throw notFound('TEACHER_APPLICATION_NOT_FOUND');
    if (!['DRAFT', 'REJECTED'].includes(teacher.status)) {
      throw badRequest('TEACHER_APPLICATION_NOT_SUBMITTABLE');
    }
    const approvedKinds = new Set(
      teacher.verificationItems
        .filter((item) => ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED'].includes(item.status))
        .map((item) => item.kind.toLowerCase()),
    );
    if (!approvedKinds.has('identity') || !approvedKinds.has('certificate')) {
      throw badRequest('TEACHER_DOCUMENTS_REQUIRED');
    }
    if (!(await this.hasValidIntroVideo(teacher.userId, teacher.introVideoFileId))) {
      throw badRequest('TEACHER_INTRO_VIDEO_REQUIRED');
    }
    if (!teacher.languageLinks.length) throw badRequest('TEACHER_LANGUAGE_REQUIRED');
    return this.transition(teacher.id, 'SUBMITTED', userId);
  }

  async transition(id: string, to: TeacherStatus, actorId: string, note?: string) {
    return this.db.$transaction(async (tx) => {
      const teacher = await tx.teacher.findUnique({ where: { id } });
      if (!teacher) throw notFound('TEACHER_NOT_FOUND');
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
        throw badRequest('TEACHER_STATUS_TRANSITION_INVALID');
      }
      if (to === 'APPROVED' && !(await this.hasValidIntroVideo(teacher.userId, teacher.introVideoFileId, tx))) {
        throw badRequest('TEACHER_INTRO_VIDEO_REQUIRED');
      }
      const output = await tx.teacher.update({
        where: { id },
        data: {
          status: to,
          ...(to === 'SUBMITTED' && { submittedAt: new Date() }),
          ...(to === 'APPROVED' && { approvedAt: new Date() }),
        },
      });
      await tx.verificationHistory.create({
        data: { teacherId: id, fromStatus: teacher.status, toStatus: to, actorId, note },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'teacher.status.changed',
          entity: 'Teacher',
          entityId: id,
          before: { status: teacher.status },
          after: { status: to, note },
        },
      });
      return output;
    });
  }

  private async hasValidIntroVideo(
    userId: string,
    fileId: string | null,
    db: Pick<PrismaService, 'storedFile'> = this.db,
  ) {
    if (!fileId) return false;
    const file = await db.storedFile.findFirst({
      where: {
        ownerId: userId,
        id: fileId,
        status: 'SAFE',
        purpose: 'teacher-intro-video',
        mimeType: { in: ['video/mp4', 'video/webm', 'video/quicktime'] },
      },
      select: { id: true },
    });
    return Boolean(file);
  }
}
