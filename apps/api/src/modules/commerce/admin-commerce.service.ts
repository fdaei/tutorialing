import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { Prisma } from '@prisma/client';
import { badRequest, conflict } from '../../common';

@Injectable()
export class AdminCommerceService {
  constructor(private readonly db: PrismaService) {}
  async payments() {
    const rows = await this.db.payment.findMany({
      include: {
        refunds: true,
        reconciliations: true,
        user: { select: { id: true, phone: true, name: true } },
        receiptFile: { select: { id: true, originalName: true, mimeType: true } },
      },
      orderBy: { createdAt: 'desc' }, take: 200,
    });
    const courseIds = [...new Set(rows.filter((row) => row.purpose === 'course').map((row) => row.referenceId))];
    const courses = courseIds.length
      ? await this.db.course.findMany({ where: { id: { in: courseIds } }, select: { id: true, titleFa: true, titleEn: true } })
      : [];
    return rows.map((row) => ({ ...row, course: courses.find((course) => course.id === row.referenceId) ?? null }));
  }
  userInvoices(userId: string) {
    return this.db.payment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true, purpose: true, amount: true, status: true, gatewayReference: true, createdAt: true,
        receiptFileId: true, reviewNote: true, reviewedAt: true,
      },
    });
  }
  async wallets() {
    const rows = await this.db.walletEntry.groupBy({
      by: ['userId', 'direction'],
      where: { account: 'user_wallet' },
      _sum: { amount: true },
      orderBy: { userId: 'asc' },
    });
    const users = await this.db.user.findMany({
      where: { id: { in: [...new Set(rows.map((row) => row.userId))] } },
      select: { id: true, name: true, phone: true, roles: true },
    });
    return users.map((user) => {
      const own = rows.filter((row) => row.userId === user.id);
      const credits = own.find((row) => row.direction === 'CREDIT')?._sum.amount ?? 0;
      const debits = own.find((row) => row.direction === 'DEBIT')?._sum.amount ?? 0;
      return { ...user, balance: credits - debits };
    });
  }

  async adjustWallet(actorId: string, userId: string, input: { amount: number; direction: 'CREDIT' | 'DEBIT'; reason: string; idempotencyKey: string }) {
    if (!input.reason.trim()) throw badRequest('WALLET_ADJUSTMENT_REASON_REQUIRED');
    return this.db.$transaction(async (tx) => {
      const existing = await tx.walletEntry.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (existing) {
        if (existing.userId !== userId || existing.referenceType !== 'AdminAdjustment') throw conflict('WALLET_ADJUSTMENT_KEY_CONFLICT');
        return existing;
      }
      await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true } });
      const grouped = await tx.walletEntry.groupBy({ by: ['direction'], where: { userId, account: 'user_wallet' }, _sum: { amount: true } });
      const before = (grouped.find((r) => r.direction === 'CREDIT')?._sum.amount ?? 0) - (grouped.find((r) => r.direction === 'DEBIT')?._sum.amount ?? 0);
      if (input.direction === 'DEBIT' && input.amount > before) throw badRequest('INSUFFICIENT_WALLET_BALANCE');
      const entry = await tx.walletEntry.create({ data: {
        userId, transactionId: `tx_${input.idempotencyKey}`, account: 'user_wallet', direction: input.direction,
        amount: input.amount, description: input.reason.trim(), referenceType: 'AdminAdjustment', referenceId: actorId,
        idempotencyKey: input.idempotencyKey,
      } });
      const after = before + (input.direction === 'CREDIT' ? input.amount : -input.amount);
      await tx.auditLog.create({ data: {
        actorId, action: 'finance.wallet.adjust', entity: 'UserWallet', entityId: userId,
        before: { balance: before }, after: { balance: after, amount: input.amount, direction: input.direction, reason: input.reason.trim() },
      } });
      return { ...entry, balanceBefore: before, balanceAfter: after };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
  reports() {
    return this.db.$transaction(async (tx) => {
      const [bookingsByStatus, paymentsByStatus, earningsByStatus, payoutsByStatus] = await Promise.all([
        tx.booking.groupBy({ by: ['status'], _count: { _all: true }, _sum: { price: true }, orderBy: { status: 'asc' } }),
        tx.payment.groupBy({ by: ['status'], _count: { _all: true }, _sum: { amount: true }, orderBy: { status: 'asc' } }),
        tx.earning.groupBy({ by: ['status'], _count: { _all: true }, _sum: { netAmount: true }, orderBy: { status: 'asc' } }),
        tx.payoutBatch.groupBy({ by: ['status'], _count: { _all: true }, _sum: { totalAmount: true }, orderBy: { status: 'asc' } }),
      ]);
      return { bookingsByStatus, paymentsByStatus, earningsByStatus, payoutsByStatus };
    });
  }
}
