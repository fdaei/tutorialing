import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class LearningRepository {
  constructor(private readonly prisma: PrismaService) {}

  findPlans(userId: string, isTeacher: boolean) {
    return this.prisma.learningPlan.findMany({
      where: isTeacher ? { teacher: { userId } } : { studentId: userId },
      include: {
        student: { select: { name: true } },
        teacher: { select: { nameFa: true, nameEn: true } },
        milestones: { orderBy: { order: 'asc' } },
        assignments: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
