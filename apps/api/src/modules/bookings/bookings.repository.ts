import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class BookingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.booking.findUnique({
      where: { id },
      include: { teacher: true, payment: true },
    });
  }

  findOverlapping(studentId: string, startsAt: Date, endsAt: Date, excludeId?: string) {
    return this.prisma.booking.count({
      where: {
        id: excludeId ? { not: excludeId } : undefined,
        studentId,
        status: { in: ['PENDING_PAYMENT', 'CONFIRMED'] },
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
    });
  }

  findStudentBookings(userId: string) {
    return this.prisma.booking.findMany({
      where: { studentId: userId },
      include: {
        teacher: { select: { nameFa: true, nameEn: true, slug: true, languageLinks: { where: { active: true }, include: { language: true } } } },
        student: { select: { name: true, phone: true, email: true } },
        classRecord: true,
        payment: { select: { id: true, status: true, amount: true } },
        review: { select: { id: true, rating: true, moderationStatus: true } },
      },
      orderBy: { startsAt: 'asc' },
    });
  }

  findTeacherBookings(userId: string) {
    return this.prisma.booking.findMany({
      where: { teacher: { userId } },
      include: {
        teacher: { select: { nameFa: true, nameEn: true, slug: true, languageLinks: { where: { active: true }, include: { language: true } } } },
        student: { select: { name: true, phone: true, email: true } },
        classRecord: true,
        payment: { select: { id: true, status: true, amount: true } },
        review: { select: { id: true, rating: true, moderationStatus: true } },
      },
      orderBy: { startsAt: 'asc' },
    });
  }

  findTeacherStudents(userId: string) {
    return this.prisma.user.findMany({
      where: { bookings: { some: { teacher: { userId }, status: { in: ['CONFIRMED', 'COMPLETED'] } } } },
      select: {
        id: true, name: true, phone: true, email: true, locale: true,
        bookings: { where: { teacher: { userId } }, select: { id: true, status: true, startsAt: true, endsAt: true }, orderBy: { startsAt: 'desc' }, take: 5 },
        learningPlans: { where: { teacher: { userId } }, select: { id: true, title: true, targetBand: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 3 },
      },
      orderBy: { updatedAt: 'desc' }, take: 200,
    });
  }
}
