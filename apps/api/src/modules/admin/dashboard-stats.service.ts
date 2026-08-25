import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { config } from '../../config';

const PLATFORM_STAT_ID = 'platform';
const RECONCILIATION_LOCK_ID = 1_394_102_781;
const RECONCILIATION_INTERVAL_MS = config().DASHBOARD_STATS_RECONCILIATION_INTERVAL_MS;

function safeNumber(value: bigint, metric: string): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new RangeError(`Dashboard metric ${metric} exceeds JSON safe integer range`);
  return number;
}

@Injectable()
export class DashboardStatsService {
  private readonly logger = new Logger(DashboardStatsService.name);

  constructor(private readonly db: PrismaService) {}

  /** Two database statements: one singleton projection read and one activity read. */
  async dashboard() {
    const [stats, recentActivity] = await this.db.$transaction([
      this.db.dashboardStat.findUniqueOrThrow({ where: { id: PLATFORM_STAT_ID } }),
      this.db.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 8 }),
    ]);

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

  /**
   * Repairs the projection from source-of-truth tables in one transaction.
   * The transaction-scoped advisory lock makes the cron single-flight across
   * API replicas. Row triggers remain active while this runs; PostgreSQL row
   * locking serializes a concurrent mutation with this UPDATE, so no delta is
   * lost when the rebuilding transaction commits.
   */
  async reconcile(): Promise<boolean> {
    return this.db.$transaction(async (tx) => {
      const [lock] = await tx.$queryRaw<Array<{ locked: boolean }>>`
        SELECT pg_try_advisory_xact_lock(${RECONCILIATION_LOCK_ID}) AS locked
      `;
      if (!lock?.locked) return false;

      // Acquire the projection row before taking the source-table snapshot.
      // A concurrent source mutation reaches its AFTER trigger before commit
      // and waits here; after this transaction commits, its delta is applied
      // on top of the rebuilt values instead of being overwritten by them.
      await tx.$queryRaw`SELECT "id" FROM "DashboardStat" WHERE "id" = ${PLATFORM_STAT_ID} FOR UPDATE`;

      await tx.$executeRaw`
        UPDATE "DashboardStat" SET
          "activeUsers" = (SELECT COUNT(*) FROM "User" WHERE "status" = 'ACTIVE'),
          "activeTeachers" = (SELECT COUNT(*) FROM "Teacher" WHERE "status" = 'APPROVED'),
          "pendingTeachers" = (SELECT COUNT(*) FROM "Teacher" WHERE "status" IN ('SUBMITTED','DOCUMENT_REVIEW','INTERVIEW','DEMO_REVIEW')),
          "testAttempts" = (SELECT COUNT(*) FROM "TestAttempt"),
          "pendingReviews" = (SELECT COUNT(*) FROM "TestAttempt" WHERE "status" = 'UNDER_REVIEW'),
          "bookings" = (SELECT COUNT(*) FROM "Booking"),
          "payments" = (SELECT COUNT(*) FROM "Payment"),
          "payouts" = (SELECT COUNT(*) FROM "PayoutBatch"),
          "openTickets" = (SELECT COUNT(*) FROM "Ticket" WHERE "status" IN ('OPEN','WAITING_SUPPORT')),
          "revenue" = COALESCE((SELECT SUM("amount") FROM "Payment" WHERE "status" = 'PAID'), 0),
          "walletCredits" = COALESCE((SELECT SUM("amount") FROM "WalletEntry" WHERE "direction" = 'CREDIT'), 0),
          "walletDebits" = COALESCE((SELECT SUM("amount") FROM "WalletEntry" WHERE "direction" = 'DEBIT'), 0),
          "reconciledAt" = CURRENT_TIMESTAMP,
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${PLATFORM_STAT_ID}
      `;
      return true;
    });
  }

  @Interval('dashboard-statistics-reconciliation', RECONCILIATION_INTERVAL_MS)
  async scheduledReconciliation() {
    try {
      await this.reconcile();
    } catch (error) {
      this.logger.error('Dashboard statistics reconciliation failed', error instanceof Error ? error.stack : undefined);
    }
  }
}
