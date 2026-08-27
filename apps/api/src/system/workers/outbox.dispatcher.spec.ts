import { bookingConfirmedKey, OutboxService, OUTBOX_EVENT_TYPES } from '../../infrastructure/database/outbox/outbox.service';
import { BookingJobsService } from '../../modules/bookings/booking-jobs.service';
import { BookingReminderReconciler } from './booking-reminder.reconciler';
import { OutboxDispatcher } from './outbox.dispatcher';

/**
 * FIN-301. `settleVerified` committed the payment and the CONFIRMED booking,
 * then enqueued the reminders as a separate call. Redis being unreachable for
 * that half-second lost the reminders permanently: the enqueue threw, and every
 * later retry of the callback saw the payment already PAID and returned early.
 *
 * The transaction now also writes an `OutboxEvent`, and these cover the other
 * half — that something later reads it and schedules the reminder, exactly
 * once, however many times it is delivered.
 */

type Event = {
  id: string;
  type: string;
  payload: unknown;
  idempotencyKey: string;
  attempts: number;
  availableAt: Date;
  processedAt: Date | null;
  lastError: string | null;
};

type Reminder = { id: string; bookingId: string; type: string; scheduledAt: Date; status: string };

/**
 * In-memory stand-ins with the semantics the production code relies on: the
 * outbox unique key on `idempotencyKey`, the `processedAt: null` guard on the
 * close, and the reminder's `(bookingId, type)` upsert — which is what makes a
 * redelivered event produce the same one reminder rather than a second.
 */
function fakeDb() {
  const events: Event[] = [];
  const reminders: Reminder[] = [];
  let seq = 0;
  const id = (prefix: string) => `${prefix}-${++seq}`;

  return {
    events,
    reminders,
    outboxEvent: {
      upsert: jest.fn(({ where, create, update }: never & Record<string, never>) => {
        const w = where as { idempotencyKey: string };
        const found = events.find((e) => e.idempotencyKey === w.idempotencyKey);
        if (found) return Promise.resolve(Object.assign(found, update));
        const row: Event = {
          id: id('evt'), attempts: 0, availableAt: new Date(), processedAt: null, lastError: null,
          ...(create as object),
        } as Event;
        events.push(row);
        return Promise.resolve(row);
      }),
      findMany: jest.fn(({ where }: never & Record<string, never>) => {
        const w = where as { availableAt: { lte: Date }; attempts: { lt: number } };
        return Promise.resolve(
          events.filter((e) => e.processedAt === null && e.availableAt <= w.availableAt.lte && e.attempts < w.attempts.lt),
        );
      }),
      updateMany: jest.fn(({ where, data }: never & Record<string, never>) => {
        const w = where as { id: string; processedAt: null };
        const row = events.find((e) => e.id === w.id && e.processedAt === null);
        if (!row) return Promise.resolve({ count: 0 });
        Object.assign(row, data);
        return Promise.resolve({ count: 1 });
      }),
      update: jest.fn(({ where, data }: never & Record<string, never>) => {
        const w = where as { id: string };
        const d = data as { attempts?: { increment: number }; lastError?: string; availableAt?: Date };
        const row = events.find((e) => e.id === w.id)!;
        if (d.attempts) row.attempts += d.attempts.increment;
        if (d.lastError !== undefined) row.lastError = d.lastError;
        if (d.availableAt) row.availableAt = d.availableAt;
        return Promise.resolve(row);
      }),
    },
    reminder: {
      upsert: jest.fn(({ where, create, update }: never & Record<string, never>) => {
        const key = (where as { bookingId_type: { bookingId: string; type: string } }).bookingId_type;
        const found = reminders.find((r) => r.bookingId === key.bookingId && r.type === key.type);
        if (found) return Promise.resolve(Object.assign(found, update));
        const row: Reminder = { id: id('rem'), status: 'scheduled', ...(create as object) } as Reminder;
        reminders.push(row);
        return Promise.resolve(row);
      }),
    },
    booking: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
  };
}

const IN_TWO_HOURS = () => new Date(Date.now() + 2 * 60 * 60_000);

function harness() {
  const db = fakeDb();
  const outbox = new OutboxService(db as never);
  const queue = { addExpiration: jest.fn().mockResolvedValue(undefined), addReminder: jest.fn().mockResolvedValue(undefined) };
  const bookings = new BookingJobsService(db as never, queue as never);
  const redis = { lock: jest.fn().mockResolvedValue({ token: 't', release: jest.fn() }) };
  const dispatcher = new OutboxDispatcher(db as never, outbox, redis as never, bookings);
  const reconciler = new BookingReminderReconciler(db as never, outbox, redis as never);
  return { db, outbox, queue, dispatcher, reconciler };
}

const confirm = (h: ReturnType<typeof harness>, bookingId: string) =>
  h.outbox.enqueue(h.db as never, OUTBOX_EVENT_TYPES.bookingConfirmed, bookingConfirmedKey(bookingId), { bookingId });

describe('OutboxDispatcher (FIN-301)', () => {
  it('schedules the reminder the queue dropped at commit time, and only one', async () => {
    const h = harness();
    // Two hours out: the 24h reminder is already in the past and skipped, so
    // this booking owes exactly one.
    h.db.booking.findUnique.mockResolvedValue({ id: 'booking-1', status: 'CONFIRMED', startsAt: IN_TWO_HOURS() });

    // The settling transaction recorded the event. The enqueue that should have
    // followed it never happened — Redis was down for that half-second.
    await confirm(h, 'booking-1');
    expect(h.db.reminders).toHaveLength(0);

    expect(await h.dispatcher.dispatch()).toEqual({ delivered: 1, failed: 0 });
    expect(h.db.reminders).toHaveLength(1);
    expect(h.queue.addReminder).toHaveBeenCalledTimes(1);

    // The event is closed, so the next tick has nothing to do.
    expect(await h.dispatcher.dispatch()).toEqual({ delivered: 0, failed: 0 });
    expect(h.db.reminders).toHaveLength(1);
  });

  it('produces the same one reminder when an event is delivered twice', async () => {
    const h = harness();
    h.db.booking.findUnique.mockResolvedValue({ id: 'booking-1', status: 'CONFIRMED', startsAt: IN_TWO_HOURS() });
    await confirm(h, 'booking-1');
    await h.dispatcher.dispatch();

    // A crash between the delivery and the bookkeeping leaves the event open,
    // so it is delivered again. The handler is idempotent on `(bookingId, type)`.
    await h.outbox.reopen(OUTBOX_EVENT_TYPES.bookingConfirmed, bookingConfirmedKey('booking-1'), {
      bookingId: 'booking-1',
    });
    expect(await h.dispatcher.dispatch()).toEqual({ delivered: 1, failed: 0 });
    expect(h.db.reminders).toHaveLength(1);
    expect(h.db.reminders[0]!.id).toBe('rem-2');
  });

  it('keeps the event open and backs it off when the queue is still unreachable', async () => {
    const h = harness();
    h.db.booking.findUnique.mockResolvedValue({ id: 'booking-1', status: 'CONFIRMED', startsAt: IN_TWO_HOURS() });
    h.queue.addReminder.mockRejectedValue(new Error('ECONNREFUSED'));
    await confirm(h, 'booking-1');

    expect(await h.dispatcher.dispatch()).toEqual({ delivered: 0, failed: 1 });
    const event = h.db.events[0]!;
    expect(event.processedAt).toBeNull();
    expect(event.attempts).toBe(1);
    expect(event.lastError).toContain('ECONNREFUSED');
    expect(event.availableAt.getTime()).toBeGreaterThan(Date.now());

    // Backed off, so an immediate tick leaves it alone; once Redis is back and
    // the backoff has elapsed, the delivery succeeds.
    expect(await h.dispatcher.dispatch()).toEqual({ delivered: 0, failed: 0 });
    h.queue.addReminder.mockResolvedValue(undefined);
    expect(await h.dispatcher.dispatch(new Date(Date.now() + 60_000))).toEqual({ delivered: 1, failed: 0 });
    expect(h.db.reminders).toHaveLength(1);
  });

  it('closes the event without scheduling when the booking is no longer confirmed', async () => {
    const h = harness();
    h.db.booking.findUnique.mockResolvedValue({ id: 'booking-1', status: 'CANCELLED', startsAt: IN_TWO_HOURS() });
    await confirm(h, 'booking-1');

    expect(await h.dispatcher.dispatch()).toEqual({ delivered: 1, failed: 0 });
    expect(h.db.reminders).toHaveLength(0);
    expect(h.db.events[0]!.processedAt).toBeInstanceOf(Date);
  });

  it('does not silently swallow an event type nothing handles', async () => {
    const h = harness();
    await h.outbox.enqueue(h.db as never, 'SOMETHING_ELSE' as never, 'key-1', {});
    expect(await h.dispatcher.dispatch()).toEqual({ delivered: 0, failed: 1 });
    expect(h.db.events[0]!.lastError).toContain('unknown outbox event type');
    expect(h.db.events[0]!.processedAt).toBeNull();
  });
});

describe('BookingReminderReconciler (FIN-301)', () => {
  it('re-arms a confirmed booking that carries no reminder at all', async () => {
    const h = harness();
    h.db.booking.findMany.mockResolvedValue([{ id: 'booking-9' }]);

    expect(await h.reconciler.reconcile()).toEqual({ repaired: 1 });
    expect(h.db.events).toHaveLength(1);
    expect(h.db.events[0]).toMatchObject({
      type: OUTBOX_EVENT_TYPES.bookingConfirmed,
      idempotencyKey: bookingConfirmedKey('booking-9'),
      processedAt: null,
    });

    // The query it asks is "confirmed, still far enough out to be worth a
    // reminder, and carrying none" — never "reminder not yet sent", which would
    // re-arm a booking whose reminder has already gone out.
    const where = (h.db.booking.findMany.mock.calls[0]![0] as { where: Record<string, unknown> }).where;
    expect(where).toMatchObject({ status: 'CONFIRMED', reminders: { none: {} } });
    expect(where.startsAt).toEqual({ gt: expect.any(Date) });
  });

  it('re-arms a booking even when its event was already marked delivered', async () => {
    const h = harness();
    h.db.booking.findUnique.mockResolvedValue({ id: 'booking-1', status: 'CONFIRMED', startsAt: IN_TWO_HOURS() });
    await confirm(h, 'booking-1');
    await h.dispatcher.dispatch();
    h.db.reminders.length = 0; // the reminder was lost some other way
    expect(h.db.events[0]!.processedAt).toBeInstanceOf(Date);

    h.db.booking.findMany.mockResolvedValue([{ id: 'booking-1' }]);
    await h.reconciler.reconcile();

    // The sweep has independent evidence the work was not done, so a processed
    // event is reopened rather than trusted.
    expect(h.db.events).toHaveLength(1);
    expect(h.db.events[0]!.processedAt).toBeNull();
    expect(await h.dispatcher.dispatch()).toEqual({ delivered: 1, failed: 0 });
    expect(h.db.reminders).toHaveLength(1);
  });
});
