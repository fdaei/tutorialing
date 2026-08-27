import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import {
  bookingConfirmedKey,
  OutboxService,
  OUTBOX_EVENT_TYPES,
} from '../../infrastructure/database/outbox/outbox.service';
import { RedisService } from '../../infrastructure/redis/redis.service';

/**
 * The backstop under the outbox.
 *
 * The outbox covers every booking confirmed through the payment path, because
 * that path writes the event inside its own transaction. It does not cover a
 * booking that reached CONFIRMED some other way — a credit-based booking, an
 * accepted reschedule — where the enqueue is still a bare call after the
 * commit. This sweep asks the only question that matters regardless of how the
 * booking got there: is it confirmed, still in the future, and carrying no
 * reminder at all?
 *
 * `reminders: { none: {} }` is deliberately "no reminder rows whatsoever"
 * rather than "no reminder still scheduled". A booking whose reminders exist
 * has been handled, whatever state they are in, and re-arming it would reset a
 * reminder that has already been sent.
 */

/**
 * A booking closer than this cannot get a reminder anyway — `scheduleBooking`
 * skips any reminder whose send time has already passed — so sweeping it up
 * every ten minutes forever would be pure noise.
 */
const MIN_LEAD_MS = 60 * 60_000;

/** Per-run cap, so one sweep cannot re-arm an unbounded number of events. */
const BATCH_SIZE = 100;

@Injectable()
export class BookingReminderReconciler {
  private readonly logger = new Logger(BookingReminderReconciler.name);

  constructor(
    private readonly db: PrismaService,
    private readonly outbox: OutboxService,
    private readonly redis: RedisService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async scheduledSweep() {
    let lock;
    try {
      lock = await this.redis.lock('booking-reminder-reconciliation', 5 * 60_000);
    } catch (error) {
      this.logger.warn(`booking reminder sweep skipped: ${describe(error)}`);
      return;
    }
    if (!lock) return;
    try {
      const summary = await this.reconcile();
      if (summary.repaired) this.logger.warn(`booking reminder sweep: ${JSON.stringify(summary)}`);
      return summary;
    } finally {
      await lock.release();
    }
  }

  async reconcile(now = new Date()) {
    const orphans = await this.db.booking.findMany({
      where: {
        status: 'CONFIRMED',
        startsAt: { gt: new Date(now.getTime() + MIN_LEAD_MS) },
        reminders: { none: {} },
      },
      orderBy: { startsAt: 'asc' },
      take: BATCH_SIZE,
      select: { id: true },
    });
    for (const booking of orphans) {
      // `reopen`, not `enqueue`: the query above is independent evidence that
      // the delivery never happened, even if an event row says it did.
      await this.outbox.reopen(OUTBOX_EVENT_TYPES.bookingConfirmed, bookingConfirmedKey(booking.id), {
        bookingId: booking.id,
      });
    }
    return { repaired: orphans.length };
  }
}

const describe = (error: unknown) => (error instanceof Error ? error.message : 'unknown error');
