import { Injectable } from '@nestjs/common';
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
    // Eligibility is derived from `eligibleAt` rather than from a status flag.
    // Selecting `status: 'ELIGIBLE'` matched nothing, because earnings are
    // created PENDING and no code path ever promoted them — so every payout run
    // reported "no eligible earnings" and teachers could never be paid. The old
    // `createdAt` window was a second, independent cause: with a 7-day hold,
    // `createdAt` inside a 7-day window forces `eligibleAt` past `weekEnd`, so
    // the two filters could not both hold. The window now describes which
    // earnings have matured by the end of the run, not when they were created.
    const earnings = await this.db.earning.findMany({
      where: { status: { in: ['PENDING', 'ELIGIBLE'] }, eligibleAt: { lte: weekEnd }, payoutItem: null },
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
    return this.db.$transaction(async tx => {
      const batch = await tx.payoutBatch.create({
        data: { weekStart, weekEnd, totalAmount: earnings.reduce((sum, e) => sum + e.netAmount, 0), items: { create: earnings.map(e => ({ earningId: e.id, teacherId: e.teacherId, amount: e.netAmount })) } },
        include: { items: true },
      });
      // `PayoutItem.earningId` is unique, so two concurrent runs cannot batch
      // the same earning — the loser fails the insert rather than paying twice.
      await tx.earning.updateMany({ where: { id: { in: earnings.map(e => e.id) } }, data: { status: 'ELIGIBLE' } });
      return batch;
    });
  }

  async approvePayout(id: string, actorId: string, reference?: string) {
    return this.db.$transaction(async tx => {
      const batch = await tx.payoutBatch.findUniqueOrThrow({ where: { id }, include: { items: true } });
      if (!['DRAFT', 'PENDING_APPROVAL'].includes(batch.status)) throw badRequest(
        'PAYOUT_BATCH_NOT_APPROVABLE',
        'این دسته تسویه در وضعیت فعلی قابل تأیید نیست.',
        'This payout batch cannot be approved in its current status.',
      );
      await tx.earning.updateMany({ where: { id: { in: batch.items.map(i => i.earningId) } }, data: { status: 'PAID' } });
      // The net amount was credited to the teacher's wallet when the lesson was
      // completed. Transferring it to their bank account takes it back out, so
      // the wallet keeps showing what the platform still owes them rather than
      // counting the same earning twice.
      if (reference) {
        for (const item of batch.items) {
          const teacher = await tx.teacher.findUniqueOrThrow({ where: { id: item.teacherId }, select: { userId: true } });
          await tx.walletEntry.upsert({
            where: { idempotencyKey: `payout-debit:${item.id}` },
            create: {
              userId: teacher.userId,
              transactionId: `tx_${batch.id}`,
              account: 'user_wallet',
              direction: 'DEBIT',
              amount: item.amount,
              description: 'payout transferred to bank account',
              referenceType: 'PayoutItem',
              referenceId: item.id,
              idempotencyKey: `payout-debit:${item.id}`,
            },
            update: {},
          });
        }
      }
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
