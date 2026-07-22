import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class TeachersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findPublicDirectory(where: any, skip: number, take: number, sortOptions: any) {
    return this.prisma.$transaction([
      this.prisma.teacher.findMany({
        where,
        skip,
        take,
        orderBy: sortOptions,
        include: {
          user: { select: { name: true } },
          languageLinks: { where: { active: true }, include: { language: true } },
          reviews: { where: { moderationStatus: 'APPROVED' }, select: { rating: true }, take: 100 },
        },
      }),
      this.prisma.teacher.count({ where }),
    ]);
  }

  findPublicProfile(slug: string) {
    return this.prisma.teacher.findUnique({
      where: { slug, status: 'APPROVED' },
      include: {
        user: { select: { name: true, phone: true } },
        languageLinks: { where: { active: true }, include: { language: true } },
        reviews: { where: { moderationStatus: 'APPROVED' }, include: { student: { select: { name: true } }, reply: true }, orderBy: { createdAt: 'desc' } },
        packages: { where: { approvalStatus: 'APPROVED' } },
        _count: { select: { bookings: { where: { status: 'COMPLETED' } }, reviews: { where: { moderationStatus: 'APPROVED' } } } },
      },
    });
  }

  findApplicationByUserId(userId: string) {
    return this.prisma.teacher.findUnique({
      where: { userId },
      include: {
        languageLinks: { include: { language: true } },
        verificationItems: { include: { file: true } },
        verificationHistory: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
  }
}
