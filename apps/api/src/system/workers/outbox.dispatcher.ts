import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { OutboxEvent } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { OutboxService, OUTBOX_EVENT_TYPES } from '../../infrastructure/database/outbox/outbox.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { BookingJobsService } from '../../modules/bookings/booking-jobs.service';

/**
 * Delivers whatever the outbox still owes.
 *
 * Handlers must be idempotent, because "delivered" and "recorded as delivered"
 * are themselves two writes and a crash can land between them. The one handler
 * here satisfies that on its own: `scheduleBooking` upserts the `Reminder` row
 * on `(bookingId, type)` and BullMQ de-duplicates on a job id derived from the
 * reminder id, so running it twice produces the same one reminder per type.
 */
@Injectable()
export class OutboxDispatcher {
  private readonly logger = new Logger(OutboxDispatcher.name);

  constructor(
    private readonly db: PrismaService,
    private readonly outbox: OutboxService,
    private readonly redis: RedisService,
    private readonly bookings: BookingJobsService,
  ) {}

  /**
   * The lock keeps one replica per tick. It is not what makes delivery safe —
   * the handlers are idempotent and `markProcessed` is a guarded update — it
   * just stops every replica from doing the same work every tick.
   *
   * A Redis outage skips the run rather than taking the process down. There is
   * nothing useful to do during one anyway: the queue this dispatcher writes to
   * is backed by the same Redis, so the events are better left owing.
   */
  @Cron(CronExpression.EVERY_30_SECONDS)
  async scheduledDispatch() {
    let lock;
    try {
      lock = await this.redis.lock('outbox-dispatch', 60_000);
    } catch (error) {
      this.logger.warn(`outbox dispatch skipped: ${describe(error)}`);
      return;
    }
    if (!lock) return;
    try {
      const summary = await this.dispatch();
      if (summary.failed) this.logger.warn(`outbox dispatch: ${JSON.stringify(summary)}`);
      return summary;
    } finally {
      await lock.release();
    }
  }

  async dispatch(now = new Date()) {
    const events = await this.outbox.due(now);
    const summary = { delivered: 0, failed: 0 };
    for (const event of events) {
      try {
        await this.handle(event);
        await this.outbox.markProcessed(event.id);
        summary.delivered++;
      } catch (error) {
        // The event stays open and backs off; nothing is dropped.
        await this.outbox.markFailed(event.id, event.attempts, error);
        summary.failed++;
        this.logger.warn(`outbox event ${event.id} (${event.type}) failed: ${describe(error)}`);
      }
    }
    return summary;
  }

  private async handle(event: OutboxEvent) {
    if (event.type !== OUTBOX_EVENT_TYPES.bookingConfirmed) {
      throw new Error(`unknown outbox event type: ${event.type}`);
    }
    const { bookingId } = (event.payload ?? {}) as { bookingId?: string };
    if (!bookingId) throw new Error('BOOKING_CONFIRMED event carries no bookingId');

    const booking = await this.db.booking.findUnique({ where: { id: bookingId } });
    // Cancelled or rescheduled away between confirmation and delivery: there is
    // no reminder to schedule, and the event is settled rather than retried.
    if (!booking || booking.status !== 'CONFIRMED') return;
    await this.bookings.scheduleBooking(booking.id, booking.startsAt);
  }
}

const describe = (error: unknown) => (error instanceof Error ? error.message : 'unknown error');
