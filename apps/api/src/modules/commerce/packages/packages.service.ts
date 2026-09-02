import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { PACKAGE_TIERS, type PackageTier } from '@lingospeak/contracts';
import { badRequest, domainError, DOMAIN_ERRORS, notFound } from '../../../common';

export type PackageInput = {
  titleFa: string;
  titleEn: string;
  descriptionFa: string;
  descriptionEn: string;
  credits: number;
  lessonMinutes: number;
  discountPercent: number;
};

@Injectable()
export class PackagesService {
  constructor(private db: PrismaService) {}

  /**
   * Creates a session package.
   *
   * The price is computed from the teacher's admin-approved regular lesson rate
   * and their own bundle discount, never taken from the request. Accepting a
   * caller-supplied price let a teacher sell lessons at a rate that had never
   * been through price review, which is the whole point of that workflow.
   *
   * Like a price proposal, a new package starts unapproved and is not sellable
   * until staff approve it.
   */
  async createPackage(userId: string, data: PackageInput) {
    const teacher = await this.db.teacher.findUnique({ where: { userId } });
    if (!teacher) throw notFound('TEACHER_PROFILE_NOT_FOUND');
    if (!PACKAGE_TIERS.includes(data.credits as PackageTier)) {
      throw badRequest('PACKAGE_TIER_INVALID');
    }
    if (teacher.approvedRegularPrice == null || teacher.approvedRegularPrice <= 0) {
      throw domainError(DOMAIN_ERRORS.TEACHER_PRICE_NOT_APPROVED);
    }
    const listPrice = teacher.approvedRegularPrice * data.credits;
    const price = listPrice - Math.round((listPrice * data.discountPercent) / 100);
    return this.db.package.create({
      data: {
        teacherId: teacher.id,
        titleFa: data.titleFa,
        titleEn: data.titleEn,
        descriptionFa: data.descriptionFa,
        descriptionEn: data.descriptionEn,
        credits: data.credits,
        lessonMinutes: data.lessonMinutes,
        listPrice,
        discountPercent: data.discountPercent,
        price,
      },
    });
  }

  async mine(userId: string) {
    const teacher = await this.db.teacher.findUnique({ where: { userId } });
    if (!teacher) throw notFound('TEACHER_PROFILE_NOT_FOUND');
    return this.db.package.findMany({ where: { teacherId: teacher.id }, orderBy: [{ credits: 'asc' }] });
  }

  listForTeacher(teacherId: string) {
    return this.db.package.findMany({
      where: { teacherId, active: true, approvalStatus: 'APPROVED' },
      orderBy: [{ credits: 'asc' }],
      select: {
        id: true,
        titleFa: true,
        titleEn: true,
        descriptionFa: true,
        descriptionEn: true,
        credits: true,
        lessonMinutes: true,
        listPrice: true,
        discountPercent: true,
        price: true,
      },
    });
  }

  enrollments(userId: string) {
    return this.db.enrollment.findMany({
      where: { studentId: userId },
      include: { package: { include: { teacher: true } }, creditEntries: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  approvePackage(id: string, actorId: string, status: 'APPROVED' | 'REJECTED') {
    return this.db.package.update({ where: { id }, data: { approvalStatus: status, approvedById: actorId } });
  }
}
