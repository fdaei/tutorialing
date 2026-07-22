import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { WalletService } from './wallet.service';

@Injectable()
export class RefundsService {
  constructor(private db: PrismaService, private wallet: WalletService) {}

  async refund(actorId: string, paymentId: string, amount: number, reason: string, idempotencyKey: string) {
    return this.db.$transaction(async tx => {
      const existing = await tx.refund.findUnique({ where: { idempotencyKey } });
      if (existing) return existing;
      const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
      const aggregate = await tx.refund.aggregate({ where: { paymentId, status: 'completed' }, _sum: { amount: true } });
      const already = aggregate._sum.amount ?? 0;
      if (amount <= 0 || amount > payment.amount - already) throw new BadRequestException('Refund amount invalid');
      const refund = await tx.refund.create({ data: { paymentId, amount, reason, status: 'completed', idempotencyKey, approvedById: actorId } });
      await this.wallet.ledger(tx, payment.userId, 'CREDIT', amount, 'refund', 'Refund', refund.id, `refund-ledger:${refund.id}`);
      await tx.payment.update({ where: { id: payment.id }, data: { status: already + amount === payment.amount ? 'REFUNDED' : 'PARTIALLY_REFUNDED' } });
      return refund;
    });
  }
}
