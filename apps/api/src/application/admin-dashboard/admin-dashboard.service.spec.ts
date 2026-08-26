import { AdminDashboardService } from './admin-dashboard.service';
import { DashboardStatsReconciler } from '../../system/workers/dashboard-stats.reconciler';

const stat = {
  id: 'platform',
  activeUsers: 10n,
  activeTeachers: 4n,
  pendingTeachers: 2n,
  testAttempts: 20n,
  pendingReviews: 3n,
  bookings: 30n,
  payments: 12n,
  payouts: 1n,
  openTickets: 5n,
  revenue: 900_000n,
  walletCredits: 400_000n,
  walletDebits: 125_000n,
  reconciledAt: new Date('2026-08-11T08:00:00Z'),
  updatedAt: new Date('2026-08-11T08:01:00Z'),
};

describe('AdminDashboardService', () => {
  it('serves all metrics with exactly two read queries', async () => {
    const repository = { load: jest.fn().mockResolvedValue([stat, [{ id: 'audit-1' }]]) };
    const result = await new AdminDashboardService(repository as never).get();
    expect(repository.load).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      users: 10,
      activeTeachers: 4,
      pendingReviews: 3,
      revenue: 900_000,
      walletLiability: 275_000,
    });
  });

  it('rebuilds only after acquiring the cross-instance advisory lock', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValueOnce([{ locked: true }]).mockResolvedValueOnce([{ id: 'platform' }]),
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
    const db = { $transaction: jest.fn((fn: (client: typeof tx) => unknown) => fn(tx)) };

    await expect(new DashboardStatsReconciler(db as never).reconcile()).resolves.toBe(true);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('does not run a competing rebuild when another replica owns the lock', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ locked: false }]),
      $executeRaw: jest.fn(),
    };
    const db = { $transaction: jest.fn((fn: (client: typeof tx) => unknown) => fn(tx)) };

    await expect(new DashboardStatsReconciler(db as never).reconcile()).resolves.toBe(false);
    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });

  it('refuses to serialize a metric after it exceeds the safe JSON integer range', async () => {
    const unsafe = { ...stat, revenue: BigInt(Number.MAX_SAFE_INTEGER) + 1n };
    const db = {
      dashboardStat: { findUniqueOrThrow: jest.fn().mockReturnValue(Promise.resolve(unsafe)) },
      auditLog: { findMany: jest.fn().mockReturnValue(Promise.resolve([])) },
      $transaction: jest.fn().mockResolvedValue([unsafe, []]),
    };

    await expect(new AdminDashboardService({ load: jest.fn().mockResolvedValue([unsafe, []]) } as never).get()).rejects.toThrow('revenue exceeds JSON safe integer');
  });
});
