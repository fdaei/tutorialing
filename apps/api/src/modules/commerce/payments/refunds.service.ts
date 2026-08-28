import { Injectable, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { WalletService } from './wallet.service';
import { conflict } from '../../../common';

@Injectable()
export class RefundsService {
  constructor(
    private db: PrismaService,
    private wallet: WalletService,
  ) {}

  async refund(actorId: string, paymentId: string, amount: number, reason: string, idempotencyKey: string) {
    return this.db.$transaction(async (tx) => {
      const existing = await tx.refund.findUnique({ where: { idempotencyKey } });
      if (existing) return existing;
      const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
      if (payment.status !== 'PAID' && payment.status !== 'PARTIALLY_REFUNDED')
        throw conflict('PAYMENT_NOT_REFUNDABLE');
      const aggregate = await tx.refund.aggregate({
        where: { paymentId, status: 'completed' },
        _sum: { amount: true },
      });
      const already = aggregate._sum.amount ?? 0;
      if (amount <= 0 || amount > payment.amount - already)
        throw new BadRequestException({ code: 'REFUND_AMOUNT_INVALID' });
      const refund = await tx.refund.create({
        data: { paymentId, amount, reason, status: 'completed', idempotencyKey, approvedById: actorId },
      });
      await this.wallet.ledger(
        tx,
        payment.userId,
        'CREDIT',
        amount,
        'refund',
        'Refund',
        refund.id,
        `refund-ledger:${refund.id}`,
      );
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: already + amount === payment.amount ? 'REFUNDED' : 'PARTIALLY_REFUNDED' },
      });
      await tx.auditLog.create({ data: {
        actorId, action: 'finance.payment.refund', entity: 'Payment', entityId: payment.id,
        before: { status: payment.status }, after: { amount, reason, refundId: refund.id },
      } });
      return refund;
      // The over-refund guard above reads SUM(refund.amount) and then inserts a
      // row that changes that same sum. At READ COMMITTED two concurrent
      // refunds both read the pre-insert total, both pass, and the payment is
      // refunded twice as real withdrawable wallet credit. `idempotencyKey`
      // only catches a replay of the *same* key, and the admin panel mints a
      // fresh UUID per click. Serializable makes Postgres detect the write skew
      // and abort the loser, matching the withdrawal path (FIN-003).
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
