import { Injectable } from '@nestjs/common';
import { PrismaService, Tx } from '../../prisma.service';

@Injectable()
export class WalletService {
  constructor(private db: PrismaService) {}

  async walletBalance(userId: string, tx: Tx = this.db) {
    const agg = await tx.walletEntry.groupBy({ by: ['direction'], where: { userId, account: 'user_wallet' }, _sum: { amount: true } });
    const cred = agg.find(x => x.direction === 'CREDIT')?._sum.amount ?? 0;
    const deb = agg.find(x => x.direction === 'DEBIT')?._sum.amount ?? 0;
    return cred - deb;
  }

  ledger(tx: Tx, userId: string, direction: 'DEBIT' | 'CREDIT', amount: number, description: string, referenceType: string, referenceId: string, idempotencyKey: string) {
    return tx.walletEntry.create({
      data: { userId, transactionId: `tx_${referenceId}`, account: 'user_wallet', direction, amount, description, referenceType, referenceId, idempotencyKey }
    });
  }
}
