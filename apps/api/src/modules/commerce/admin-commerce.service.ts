import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';

@Injectable()
export class AdminCommerceService {
  constructor(private readonly db: PrismaService) {}
  payments() {
    return this.db.payment.findMany({
      include: { refunds: true, reconciliations: true, user: { select: { phone: true, name: true } } },
      orderBy: { createdAt: 'desc' }, take: 200,
    });
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
