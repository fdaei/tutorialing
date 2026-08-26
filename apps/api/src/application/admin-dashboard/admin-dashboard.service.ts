import { Injectable } from '@nestjs/common';
import { DashboardReadRepository } from './infrastructure/dashboard-read.repository';

function safeNumber(value: bigint, metric: string): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new RangeError(`Dashboard metric ${metric} exceeds JSON safe integer range`);
  return number;
}

@Injectable()
export class AdminDashboardService {
  constructor(private readonly repository: DashboardReadRepository) {}

  /** Two database statements: one singleton projection read and one activity read. */
  async get() {
    const [stats, recentActivity] = await this.repository.load();

    return {
      users: safeNumber(stats.activeUsers, 'activeUsers'),
      activeTeachers: safeNumber(stats.activeTeachers, 'activeTeachers'),
      pendingTeachers: safeNumber(stats.pendingTeachers, 'pendingTeachers'),
      testAttempts: safeNumber(stats.testAttempts, 'testAttempts'),
      pendingReviews: safeNumber(stats.pendingReviews, 'pendingReviews'),
      bookings: safeNumber(stats.bookings, 'bookings'),
      payments: safeNumber(stats.payments, 'payments'),
      payouts: safeNumber(stats.payouts, 'payouts'),
      openTickets: safeNumber(stats.openTickets, 'openTickets'),
      revenue: safeNumber(stats.revenue, 'revenue'),
      walletLiability: safeNumber(stats.walletCredits - stats.walletDebits, 'walletLiability'),
      statsUpdatedAt: stats.updatedAt,
      statsReconciledAt: stats.reconciledAt,
      recentActivity,
    };
  }

}
