import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DbClient, PrismaService } from '../prisma.service';

/**
 * Transactional outbox.
 *
 * A state change and the message announcing it are two different systems, and
 * committing the first before reaching the second is where messages disappear:
 * the payment commits, then Redis is unreachable for the half-second it takes
 * to enqueue the reminder, and nothing ever schedules it again — a later retry
 * sees the payment already PAID and returns early.
 *
 * Writing the message as a row in the same transaction removes the gap. Either
 * both land or neither does, and `OutboxDispatcher` delivers whatever is left
 * owing on its own schedule.
 */

export const OUTBOX_EVENT_TYPES = {
  /** A booking reached CONFIRMED and owes its student and teacher reminders. */
  bookingConfirmed: 'BOOKING_CONFIRMED',
} as const;

export type OutboxEventType = (typeof OUTBOX_EVENT_TYPES)[keyof typeof OUTBOX_EVENT_TYPES];

/** Idempotency key for a booking's confirmation event; stable across retries. */
export const bookingConfirmedKey = (bookingId: string) => `booking-confirmed:${bookingId}`;

/**
 * After this many failed deliveries an event stops being picked up. It is not
 * deleted: `lastError` and `attempts` are the record of what went wrong, and a
 * stuck event should be visible rather than silently retried forever.
 */
export const OUTBOX_MAX_ATTEMPTS = 10;

const BASE_BACKOFF_MS = 30_000;
const MAX_BACKOFF_MS = 60 * 60_000;
const DEFAULT_BATCH_SIZE = 100;

@Injectable()
export class OutboxService {
  constructor(private readonly db: PrismaService) {}

  /**
   * Records an event from inside the transaction that caused it. `upsert`
   * rather than `create` because a settlement can legitimately be replayed
   * (reconciliation re-verifies a capture the callback never recorded), and a
   * unique-key collision there would abort the payment transaction itself.
   */
  enqueue(tx: DbClient, type: OutboxEventType, idempotencyKey: string, payload: Prisma.InputJsonValue) {
    return tx.outboxEvent.upsert({
      where: { idempotencyKey },
      create: { type, idempotencyKey, payload },
      update: {},
    });
  }

  /**
   * Re-arms an event for work a repair sweep has established from the database
   * was never done. Only the sweep may call this: an event marked processed is
   * normally proof the delivery happened, and the sweep is the one caller that
   * has independent evidence it did not.
   */
  reopen(type: OutboxEventType, idempotencyKey: string, payload: Prisma.InputJsonValue) {
    return this.db.outboxEvent.upsert({
      where: { idempotencyKey },
      create: { type, idempotencyKey, payload },
      update: { processedAt: null, availableAt: new Date(), attempts: 0, lastError: null },
    });
  }

  /** Events still owed a delivery and past their backoff, oldest first. */
  due(now = new Date(), take = DEFAULT_BATCH_SIZE) {
    return this.db.outboxEvent.findMany({
      where: { processedAt: null, availableAt: { lte: now }, attempts: { lt: OUTBOX_MAX_ATTEMPTS } },
      orderBy: { createdAt: 'asc' },
      take,
    });
  }

  /**
   * Closes the event only while it is still open, so two dispatchers that both
   * delivered it do not both count it as theirs. Handlers are idempotent, so a
   * double delivery is harmless; a double *count* would misreport the backlog.
   */
  async markProcessed(id: string) {
    const closed = await this.db.outboxEvent.updateMany({
      where: { id, processedAt: null },
      data: { processedAt: new Date(), lastError: null },
    });
    return closed.count === 1;
  }

  /** Records the failure and pushes the next attempt out exponentially. */
  markFailed(id: string, attempts: number, error: unknown) {
    return this.db.outboxEvent.update({
      where: { id },
      data: {
        attempts: { increment: 1 },
        lastError: (error instanceof Error ? error.message : String(error)).slice(0, 1_000),
        availableAt: new Date(Date.now() + Math.min(BASE_BACKOFF_MS * 2 ** attempts, MAX_BACKOFF_MS)),
      },
    });
  }
}
