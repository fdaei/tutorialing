import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { badRequest, conflict, isPrismaKnownError } from '../../../common';

@Injectable()
export class PayoutsService {
  constructor(private db: PrismaService) {}

  async generatePayout(weekStart: Date, weekEnd: Date) {
    if (!Number.isFinite(weekStart.getTime()) || !Number.isFinite(weekEnd.getTime()) || weekEnd <= weekStart) {
      throw badRequest('PAYOUT_PERIOD_INVALID');
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
      include: {
        booking: {
          select: { status: true, attendanceTeacher: true, attendanceStudent: true, startsAt: true, endsAt: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    if (!earnings.length) {
      const [completed, waiting, paid] = await this.db.$transaction([
        this.db.booking.aggregate({
          where: { status: 'COMPLETED', endsAt: { gte: weekStart, lte: weekEnd }, attendanceTeacher: true },
          _sum: { price: true },
        }),
        this.db.booking.aggregate({
          where: { status: { in: ['PENDING_PAYMENT', 'CONFIRMED'] }, startsAt: { gte: weekStart, lte: weekEnd } },
          _sum: { price: true },
        }),
        this.db.earning.aggregate({
          where: {
            createdAt: { gte: weekStart, lte: weekEnd },
            OR: [{ status: 'PAID' }, { payoutItem: { isNot: null } }],
          },
          _sum: { netAmount: true },
        }),
      ]);
      throw badRequest('NO_ELIGIBLE_TEACHER_EARNINGS', {
        completedAmount: String(completed._sum.price ?? 0),
        waitingAmount: String(waiting._sum.price ?? 0),
        paidAmount: String(paid._sum.netAmount ?? 0),
      });
    }
    return this.db.$transaction(async (tx) => {
      const batch = await tx.payoutBatch.create({
        data: {
          weekStart,
          weekEnd,
          totalAmount: earnings.reduce((sum, e) => sum + e.netAmount, 0),
          items: { create: earnings.map((e) => ({ earningId: e.id, teacherId: e.teacherId, amount: e.netAmount })) },
        },
        include: { items: true },
      });
      // `PayoutItem.earningId` is unique, so two concurrent runs cannot batch
      // the same earning — the loser fails the insert rather than paying twice.
      await tx.earning.updateMany({ where: { id: { in: earnings.map((e) => e.id) } }, data: { status: 'ELIGIBLE' } });
      return batch;
    });
  }

  async approvePayout(id: string, actorId: string, reference?: string) {
    return this.db.$transaction(async (tx) => {
      const batch = await tx.payoutBatch.findUniqueOrThrow({ where: { id }, include: { items: true } });
      if (!['DRAFT', 'PENDING_APPROVAL'].includes(batch.status)) throw badRequest('PAYOUT_BATCH_NOT_APPROVABLE');
      await tx.earning.updateMany({
        where: { id: { in: batch.items.map((i) => i.earningId) } },
        data: { status: 'PAID' },
      });
      // The net amount was credited to the teacher's wallet when the lesson was
      // completed. Transferring it to their bank account takes it back out, so
      // the wallet keeps showing what the platform still owes them rather than
      // counting the same earning twice.
      if (reference) {
        for (const item of batch.items) {
          const teacher = await tx.teacher.findUniqueOrThrow({
            where: { id: item.teacherId },
            select: { userId: true },
          });
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
      return tx.payoutBatch.update({
        where: { id },
        data: {
          status: reference ? 'TRANSFERRED' : 'APPROVED',
          approvedById: actorId,
          approvedAt: new Date(),
          reference,
          transferredAt: reference ? new Date() : undefined,
        },
      });
    });
  }

  async teacherFinance(userId: string) {
    const teacher = await this.db.teacher.findUniqueOrThrow({ where: { userId } });
    const earnings = await this.db.earning.findMany({
      where: { teacherId: teacher.id },
      orderBy: { createdAt: 'desc' },
    });
    const totals = await this.db.earning.groupBy({
      by: ['status'],
      where: { teacherId: teacher.id },
      _sum: { netAmount: true },
      orderBy: { status: 'asc' },
    });
    const payouts = await this.db.payoutItem.findMany({
      where: { teacherId: teacher.id },
      include: { batch: true },
      orderBy: { batch: { createdAt: 'desc' } },
    });
    const withdrawals = await this.db.withdrawalRequest.findMany({
      where: { teacherId: teacher.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const ledger = await this.db.walletEntry.groupBy({
      by: ['direction'],
      where: { userId, account: 'user_wallet' },
      _sum: { amount: true },
    });
    const walletBalance =
      (ledger.find((row) => row.direction === 'CREDIT')?._sum.amount ?? 0) -
      (ledger.find((row) => row.direction === 'DEBIT')?._sum.amount ?? 0);
    const reservedAmount = withdrawals
      .filter((row) => ['PENDING', 'APPROVED'].includes(row.status))
      .reduce((sum, row) => sum + row.amount, 0);
    return {
      earnings,
      totals,
      payouts,
      withdrawals,
      walletBalance,
      reservedAmount,
      availableToWithdraw: Math.max(0, walletBalance - reservedAmount),
    };
  }

  async requestWithdrawal(userId: string, amount: number, iban: string, idempotencyKey: string) {
    const teacher = await this.db.teacher.findUniqueOrThrow({ where: { userId } });
    const normalizedIban = iban.replace(/\s/g, '').toUpperCase();
    // Replaying a key returns the original request rather than hitting the
    // unique index, so a client retrying after a dropped response converges
    // instead of either erroring or opening a second withdrawal.
    const replay = await this.db.withdrawalRequest.findUnique({ where: { idempotencyKey } });
    if (replay) return this.assertOwnedByTeacher(replay, teacher.id);
    // Serializable, matching every other balance-checking transaction in this
    // domain (payments.service.ts, bookings.service.ts): at the default
    // READ COMMITTED level, two concurrent requests could both read the same
    // `available` balance before either's create commits, letting a teacher
    // over-withdraw. Under Serializable, Postgres aborts the loser with P2034,
    // which the global exception filter already maps to a 409.
    return this.db
      .$transaction(
        async (tx) => {
          const ledger = await tx.walletEntry.groupBy({
            by: ['direction'],
            where: { userId, account: 'user_wallet' },
            _sum: { amount: true },
          });
          const balance =
            (ledger.find((row) => row.direction === 'CREDIT')?._sum.amount ?? 0) -
            (ledger.find((row) => row.direction === 'DEBIT')?._sum.amount ?? 0);
          const pending = await tx.withdrawalRequest.aggregate({
            where: { teacherId: teacher.id, status: { in: ['PENDING', 'APPROVED'] } },
            _sum: { amount: true },
          });
          const available = balance - (pending._sum.amount ?? 0);
          if (amount > available) throw badRequest('WITHDRAWAL_INSUFFICIENT_BALANCE');
          return tx.withdrawalRequest.create({
            data: { teacherId: teacher.id, amount, iban: normalizedIban, idempotencyKey },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )
      .catch(async (error) => {
        // Two concurrent submits of the same key: the loser hits the unique
        // index and re-reads the winner's row.
        if (!isPrismaKnownError(error) || error.code !== 'P2002') throw error;
        const raced = await this.db.withdrawalRequest.findUnique({ where: { idempotencyKey } });
        if (!raced) throw error;
        return this.assertOwnedByTeacher(raced, teacher.id);
      });
  }

  /**
   * An idempotency key is client-chosen, so a guessed key must not disclose
   * another teacher's withdrawal request.
   */
  private assertOwnedByTeacher<T extends { teacherId: string }>(request: T, teacherId: string) {
    if (request.teacherId !== teacherId) throw conflict('WITHDRAWAL_KEY_CONFLICT');
    return request;
  }

  withdrawalRequests() {
    return this.db.withdrawalRequest.findMany({
      include: { teacher: { select: { nameFa: true, nameEn: true, user: { select: { phone: true } } } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async transferWithdrawal(id: string, actorId: string, reference?: string) {
    return this.db.$transaction(async (tx) => {
      const request = await tx.withdrawalRequest.findUniqueOrThrow({
        where: { id },
        include: { teacher: { select: { userId: true } } },
      });
      if (!['PENDING', 'APPROVED'].includes(request.status)) throw badRequest('WITHDRAWAL_NOT_TRANSFERABLE');
      if (!reference) throw badRequest('WITHDRAWAL_REFERENCE_REQUIRED');
      await tx.walletEntry.upsert({
        where: { idempotencyKey: `withdrawal-debit:${request.id}` },
        create: {
          userId: request.teacher.userId,
          transactionId: `tx_${request.id}`,
          account: 'user_wallet',
          direction: 'DEBIT',
          amount: request.amount,
          description: 'teacher wallet withdrawal',
          referenceType: 'WithdrawalRequest',
          referenceId: request.id,
          idempotencyKey: `withdrawal-debit:${request.id}`,
        },
        update: {},
      });
      return tx.withdrawalRequest.update({
        where: { id },
        data: {
          status: 'TRANSFERRED',
          reference,
          reviewedById: actorId,
          reviewedAt: new Date(),
          transferredAt: new Date(),
        },
      });
    });
  }
}
