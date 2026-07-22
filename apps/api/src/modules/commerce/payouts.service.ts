import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { badRequest } from '../../common/errors';

@Injectable()
export class PayoutsService {
  constructor(private db: PrismaService) {}

  async generatePayout(weekStart: Date, weekEnd: Date) {
    if (!Number.isFinite(weekStart.getTime()) || !Number.isFinite(weekEnd.getTime()) || weekEnd <= weekStart) {
      throw badRequest('PAYOUT_PERIOD_INVALID', 'بازه تسویه معتبر نیست.', 'The payout period is invalid.', {
        weekEnd: { fa: 'تاریخ پایان باید بعد از تاریخ شروع باشد و هر دو تاریخ را از تقویم انتخاب کنید.', en: 'The end date must be after the start date; choose both dates from the date picker.' },
      });
    }
    const earnings = await this.db.earning.findMany({
      where: { status: 'ELIGIBLE', eligibleAt: { lte: weekEnd }, createdAt: { gte: weekStart, lte: weekEnd }, payoutItem: null },
      include: { booking: { select: { status: true, attendanceTeacher: true, attendanceStudent: true, startsAt: true, endsAt: true } } },
      orderBy: { createdAt: 'asc' },
    });
    if (!earnings.length) {
      const [completed, waiting, paid] = await this.db.$transaction([
        this.db.booking.count({ where: { status: 'COMPLETED', endsAt: { gte: weekStart, lte: weekEnd }, attendanceTeacher: true } }),
        this.db.booking.count({ where: { status: { in: ['PENDING_PAYMENT', 'CONFIRMED'] }, startsAt: { gte: weekStart, lte: weekEnd } } }),
        this.db.earning.count({ where: { createdAt: { gte: weekStart, lte: weekEnd }, OR: [{ status: 'PAID' }, { payoutItem: { isNot: null } }] } }),
      ]);
      throw badRequest(
        'NO_ELIGIBLE_TEACHER_EARNINGS',
        'در این بازه درآمد قابل تسویه‌ای پیدا نشد. فقط کلاس‌هایی که برگزار و تکمیل شده‌اند، حضور مدرس برای آن‌ها ثبت شده و قبلاً تسویه نشده‌اند وارد تسویه می‌شوند.',
        'No payable teacher earnings were found in this period. Only completed lessons with recorded teacher attendance that have not already been paid are eligible.',
        {
          period: {
            fa: `کلاس تکمیل‌شده: ${completed}، کلاس در انتظار تکمیل: ${waiting}، درآمد قبلاً تسویه‌شده: ${paid}. بازه یا وضعیت کلاس‌ها را بررسی کنید.`,
            en: `Completed lessons: ${completed}; waiting for completion: ${waiting}; already paid earnings: ${paid}. Review the period or lesson statuses.`,
          },
        }
      );
    }
    return this.db.$transaction(async tx => tx.payoutBatch.create({
      data: { weekStart, weekEnd, totalAmount: earnings.reduce((sum, e) => sum + e.netAmount, 0), items: { create: earnings.map(e => ({ earningId: e.id, teacherId: e.teacherId, amount: e.netAmount })) } },
      include: { items: true },
    }));
  }

  async approvePayout(id: string, actorId: string, reference?: string) {
    return this.db.$transaction(async tx => {
      const batch = await tx.payoutBatch.findUniqueOrThrow({ where: { id }, include: { items: true } });
      if (!['DRAFT', 'PENDING_APPROVAL'].includes(batch.status)) throw new BadRequestException();
      await tx.earning.updateMany({ where: { id: { in: batch.items.map(i => i.earningId) } }, data: { status: 'PAID' } });
      return tx.payoutBatch.update({ where: { id }, data: { status: reference ? 'TRANSFERRED' : 'APPROVED', approvedById: actorId, approvedAt: new Date(), reference, transferredAt: reference ? new Date() : undefined } });
    });
  }

  async teacherFinance(userId: string) {
    const teacher = await this.db.teacher.findUniqueOrThrow({ where: { userId } });
    const earnings = await this.db.earning.findMany({ where: { teacherId: teacher.id }, orderBy: { createdAt: 'desc' } });
    const totals = await this.db.earning.groupBy({ by: ['status'], where: { teacherId: teacher.id }, _sum: { netAmount: true }, orderBy: { status: 'asc' } });
    const payouts = await this.db.payoutItem.findMany({ where: { teacherId: teacher.id }, include: { batch: true }, orderBy: { batch: { createdAt: 'desc' } } });
    return { earnings, totals, payouts };
  }
}
