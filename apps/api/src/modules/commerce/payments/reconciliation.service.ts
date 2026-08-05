import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Payment } from '@prisma/client';
import { PrismaService } from '../../../prisma.service';
import { RedisService } from '../../../common';
import { GatewayService } from './gateway.service';
import { PaymentsService } from './payments.service';

/**
 * Closes the one gap the payment flow cannot close by itself.
 *
 * `PaymentsService.callback()` calls `gateway.verify()` — an irreversible
 * capture on Zarinpal's side — and only then opens the transaction that marks
 * the payment PAID and grants the entitlement. If the process dies, the
 * connection drops, or the request is otherwise interrupted between those two
 * steps, Zarinpal has the money and our database still shows PENDING/EXPIRED/
 * FAILED with nothing granted. A replayed callback repairs it (Zarinpal answers
 * code 101, "already verified", which `gateway.verify()` accepts), but a user
 * who closes the tab before the redirect completes never replays anything, and
 * until now nothing else looked.
 *
 * This job is that second look: it re-verifies stale settleable payments
 * against the provider, records every discrepancy it finds as a `Reconciliation`
 * row, and repairs the ones the provider confirms by running them through the
 * same settlement path a real callback would have taken.
 */

/**
 * How long a payment must sit untouched before it is a reconciliation
 * candidate. Anything younger may simply be a user still on the gateway page,
 * and re-verifying it would race the callback that is about to arrive.
 */
const STALE_AFTER_MS = 15 * 60e3;

/**
 * How far back to look. Zarinpal authorities do not stay verifiable forever,
 * and a payment this old has either been repaired already or is a permanent
 * mismatch that needs a human, not another automated verify call.
 */
const HORIZON_MS = 30 * 864e5;

/** Per-run cap, so one sweep cannot make an unbounded number of outbound calls. */
const BATCH_SIZE = 50;

@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(
    private db: PrismaService,
    private redis: RedisService,
    private gateway: GatewayService,
    private payments: PaymentsService,
  ) {}

  /**
   * The lock keeps the sweep single-flight across instances: `@Cron` fires in
   * every process, and without it two workers would verify — and try to settle
   * — the same payment at the same time. The TTL comfortably exceeds one run
   * and is well under the interval, so a crashed run frees the lock before the
   * next tick rather than wedging the job forever.
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async sweep() {
    let lock;
    try {
      lock = await this.redis.lock('payment-reconciliation', 5 * 60e3);
    } catch (error) {
      // Redis being down must not take the API process with it; the next tick
      // retries, and nothing is lost because candidates are re-derived from the
      // database each run rather than held in memory.
      this.logger.warn(`reconciliation sweep skipped: ${this.describe(error)}`);
      return;
    }
    if (!lock) return;
    try {
      const summary = await this.reconcile();
      if (summary.mismatched) this.logger.warn(`reconciliation: ${JSON.stringify(summary)}`);
      return summary;
    } finally {
      await lock.release();
    }
  }

  async reconcile(now = new Date()) {
    const candidates = await this.candidates(now);
    const summary = { checked: 0, mismatched: 0, repaired: 0, unrepaired: 0 };
    for (const payment of candidates) {
      summary.checked++;
      const result = await this.verify(payment);
      // `undefined` means the provider could not be reached. That is not
      // evidence of a match, so no row is written and the payment stays a
      // candidate for the next run.
      if (result === undefined) continue;
      // Provider and database agree that no capture happened. Writing a row for
      // every such payment on every run would bury the real mismatches, so the
      // agreeing case is deliberately silent.
      if (!result.ok) continue;
      summary.mismatched++;
      const record = await this.flag(payment, result.reference);
      const repaired = await this.repair(payment, result.reference);
      if (!repaired) {
        summary.unrepaired++;
        continue;
      }
      summary.repaired++;
      await this.db.reconciliation.update({
        where: { id: record.id },
        data: { matched: true, details: { ...record.details, repairedTo: repaired.status, repairedAt: new Date().toISOString() } },
      });
    }
    return summary;
  }

  private candidates(now: Date) {
    return this.db.payment.findMany({
      where: {
        status: { in: PaymentsService.SETTLEABLE },
        // No authority means the user never reached the gateway, so there is
        // nothing the provider could have captured.
        authority: { not: null },
        updatedAt: { lt: new Date(now.getTime() - STALE_AFTER_MS), gt: new Date(now.getTime() - HORIZON_MS) },
      },
      orderBy: { updatedAt: 'asc' },
      take: BATCH_SIZE,
    });
  }

  /**
   * A `dev_` authority is never a real capture: with no merchant id configured
   * `gateway.verify()` auto-approves it so the local payment simulator works.
   * Sweeping those would silently fulfil every abandoned checkout in a
   * development database.
   */
  private async verify(payment: Payment) {
    if (!payment.authority || payment.authority.startsWith('dev_')) return { ok: false } as const;
    try {
      return await this.gateway.verify(payment.authority, payment.gatewayAmount);
    } catch (error) {
      this.logger.warn(`reconciliation verify failed for payment ${payment.id}: ${this.describe(error)}`);
      return undefined;
    }
  }

  /**
   * Records the discrepancy before attempting to fix it, so a repair that
   * itself crashes still leaves a trail. One open row per payment: a mismatch
   * that survives several sweeps is still one incident, and duplicating it each
   * run would make the table useless for spotting the real backlog.
   */
  private async flag(payment: Payment, reference: string | undefined) {
    const details = { detectedBy: 'reconciliation', reference: reference ?? null, statusWhenDetected: payment.status, authority: payment.authority };
    const open = await this.db.reconciliation.findFirst({ where: { paymentId: payment.id, matched: false }, orderBy: { createdAt: 'desc' } });
    const record = open
      ? await this.db.reconciliation.update({ where: { id: open.id }, data: { providerAmount: payment.gatewayAmount, details } })
      : await this.db.reconciliation.create({ data: { paymentId: payment.id, providerAmount: payment.gatewayAmount, providerStatus: 'verified', matched: false, details } });
    return { id: record.id, details };
  }

  /**
   * Settles through the same path a real callback takes, so the entitlement
   * rules stay in one place — including `fulfill`'s handling of a booking whose
   * slot is gone, which returns the capture to the student's wallet rather than
   * confirming a lesson we can no longer deliver.
   */
  private async repair(payment: Payment, reference: string | undefined) {
    try {
      return await this.payments.settleVerified(payment.id, reference, { authority: payment.authority, status: 'OK', source: 'reconciliation' });
    } catch (error) {
      this.logger.error(`reconciliation repair failed for payment ${payment.id}: ${this.describe(error)}`);
      return undefined;
    }
  }

  private describe(error: unknown) {
    return error instanceof Error ? error.message : 'unknown error';
  }
}
