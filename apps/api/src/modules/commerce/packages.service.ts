import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class PackagesService {
  constructor(private db: PrismaService) {}

  async createPackage(userId: string, data: { titleFa: string; titleEn: string; descriptionFa: string; descriptionEn: string; credits: number; lessonMinutes: number; price: number }) {
    const teacher = await this.db.teacher.findUniqueOrThrow({ where: { userId } });
    return this.db.package.create({ data: { ...data, teacherId: teacher.id } });
  }

  enrollments(userId: string) {
    return this.db.enrollment.findMany({ where: { studentId: userId }, include: { package: { include: { teacher: true } }, creditEntries: true }, orderBy: { createdAt: 'desc' } });
  }

  approvePackage(id: string, actorId: string, status: 'APPROVED' | 'REJECTED') {
    return this.db.package.update({ where: { id }, data: { approvalStatus: status, approvedById: actorId } });
  }
}
