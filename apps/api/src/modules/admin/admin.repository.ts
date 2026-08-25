import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class AdminRepository {
  constructor(private readonly prisma: PrismaService) {}

  getUsers(where: Prisma.UserWhereInput, skip: number, take: number) {
    return this.prisma.$transaction([
      this.prisma.user.findMany({ where, skip, take, include: { roles: true }, orderBy: { createdAt: 'desc' } }),
      this.prisma.user.count({ where }),
    ]);
  }

  getTeacherApplications() {
    return this.prisma.teacher.findMany({
      where: { status: { notIn: ['DRAFT', 'APPROVED'] } },
      include: {
        user: { select: { phone: true, email: true } },
        verificationItems: { include: { file: true } },
        verificationHistory: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: { submittedAt: 'asc' },
    });
  }

  getBookings() {
    return this.prisma.booking.findMany({
      include: {
        student: { select: { name: true, phone: true } },
        teacher: { select: { nameFa: true, nameEn: true, slug: true } },
        payment: true,
        classRecord: true,
      },
      orderBy: { startsAt: 'desc' },
      take: 200,
    });
  }

  getTickets() {
    return this.prisma.ticket.findMany({
      include: {
        user: { select: { name: true, phone: true } },
        replies: { orderBy: { createdAt: 'asc' }, take: 5 },
      },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
      take: 200,
    });
  }

  getNotificationDeliveries() {
    return this.prisma.notificationDelivery.findMany({
      include: {
        notification: { select: { userId: true, type: true, titleFa: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  getRoles() {
    return this.prisma.userRole.findMany({
      include: {
        user: { select: { phone: true, name: true } },
        permissions: { include: { permission: true } },
      },
      orderBy: { userId: 'asc' },
      take: 300,
    });
  }

  getPayments() {
    return this.prisma.payment.findMany({
      include: {
        refunds: true,
        reconciliations: true,
        user: { select: { phone: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }
}
