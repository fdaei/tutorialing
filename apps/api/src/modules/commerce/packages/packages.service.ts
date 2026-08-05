import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma.service';
import { PACKAGE_TIERS, type PackageTier } from '@lingospeak/contracts';
import { badRequest, conflict, notFound } from '../../../common';

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
    if (!teacher) throw notFound('TEACHER_PROFILE_NOT_FOUND', 'پروفایل مدرس پیدا نشد.', 'Teacher profile was not found.');
    if (!PACKAGE_TIERS.includes(data.credits as PackageTier)) {
      throw badRequest(
        'PACKAGE_TIER_INVALID',
        `تعداد جلسات بسته باید یکی از مقادیر ${PACKAGE_TIERS.join('، ')} باشد.`,
        `Package session count must be one of ${PACKAGE_TIERS.join(', ')}.`,
        { credits: { fa: 'یکی از بسته‌های مجاز را انتخاب کنید.', en: 'Choose one of the allowed tiers.' } },
      );
    }
    if (teacher.approvedRegularPrice == null || teacher.approvedRegularPrice <= 0) {
      throw conflict(
        'TEACHER_PRICE_NOT_APPROVED',
        'تا زمانی که قیمت جلسه عادی شما تأیید نشده باشد، امکان ساخت بسته وجود ندارد.',
        'You cannot create a package until your regular lesson price has been approved.',
      );
    }
    const listPrice = teacher.approvedRegularPrice * data.credits;
    const price = listPrice - Math.round(listPrice * data.discountPercent / 100);
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

  /** A teacher's own packages, including the unapproved ones. */
  async mine(userId: string) {
    const teacher = await this.db.teacher.findUnique({ where: { userId } });
    if (!teacher) throw notFound('TEACHER_PROFILE_NOT_FOUND', 'پروفایل مدرس پیدا نشد.', 'Teacher profile was not found.');
    return this.db.package.findMany({ where: { teacherId: teacher.id }, orderBy: [{ credits: 'asc' }] });
  }

  /** Packages a student can actually buy from a teacher. */
  listForTeacher(teacherId: string) {
    return this.db.package.findMany({
      where: { teacherId, active: true, approvalStatus: 'APPROVED' },
      orderBy: [{ credits: 'asc' }],
      select: { id: true, titleFa: true, titleEn: true, descriptionFa: true, descriptionEn: true, credits: true, lessonMinutes: true, listPrice: true, discountPercent: true, price: true },
    });
  }

  enrollments(userId: string) {
    return this.db.enrollment.findMany({ where: { studentId: userId }, include: { package: { include: { teacher: true } }, creditEntries: true }, orderBy: { createdAt: 'desc' } });
  }

  approvePackage(id: string, actorId: string, status: 'APPROVED' | 'REJECTED') {
    return this.db.package.update({ where: { id }, data: { approvalStatus: status, approvedById: actorId } });
  }
}
