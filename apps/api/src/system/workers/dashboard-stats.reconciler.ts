import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { config } from '../../config';
import { PrismaService } from '../../infrastructure/database/prisma.service';

const RECONCILIATION_LOCK_ID = 1_394_102_781;

@Injectable()
export class DashboardStatsReconciler {
  private readonly logger = new Logger(DashboardStatsReconciler.name);
  constructor(private readonly db: PrismaService) {}

  async reconcile(): Promise<boolean> {
    return this.db.$transaction(async (tx) => {
      const [lock] = await tx.$queryRaw<Array<{ locked: boolean }>>`
        SELECT pg_try_advisory_xact_lock(${RECONCILIATION_LOCK_ID}) AS locked
      `;
      if (!lock?.locked) return false;
      await tx.$queryRaw`SELECT "id" FROM "DashboardStat" WHERE "id" = 'platform' FOR UPDATE`;
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
          "reconciledAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = 'platform'
      `;
      return true;
    });
  }

  @Interval('dashboard-statistics-reconciliation', config().DASHBOARD_STATS_RECONCILIATION_INTERVAL_MS)
  async scheduledReconciliation() {
    try { await this.reconcile(); }
    catch (error) { this.logger.error('Dashboard statistics reconciliation failed', error instanceof Error ? error.stack : undefined); }
  }
}
