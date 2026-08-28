import { BookingsService } from './bookings.service';

const TEACHER = 'teacher-1';
const STUDENT = 'student-1';
const HOUR_MS = 3_600_000;

type Counts = { trialUsed?: number };

/**
 * Builds a service whose slot machinery always succeeds, so these tests isolate
 * the booking-window and trial rules that run before it.
 */
function harness(options: { settings?: Record<string, number>; counts?: Counts } = {}) {
  const lock = { release: jest.fn() };
  const redis = { lock: jest.fn().mockResolvedValue(lock) };
  const settings = {
    numeric: jest
      .fn()
      .mockImplementation((key: string, fallback: number) => Promise.resolve(options.settings?.[key] ?? fallback)),
  };
  // The student-overlap check is the first count() in the transaction. Trial
  // bookings make one additional query to enforce the one-trial limit; regular
  // lessons do not depend on trial history.
  const counts = options.counts ?? {};
  const bookingCount = jest
    .fn()
    .mockResolvedValueOnce(0)
    .mockResolvedValueOnce(counts.trialUsed ?? 0);
  const tx = {
    booking: {
      count: bookingCount,
      create: jest.fn().mockResolvedValue({ id: 'booking-new', startsAt: new Date(), paymentExpiresAt: null }),
    },
    creditEntry: { create: jest.fn(), aggregate: jest.fn() },
    enrollment: { findFirst: jest.fn() },
    discount: { findFirst: jest.fn(), update: jest.fn() },
    payment: { create: jest.fn().mockResolvedValue({ id: 'payment-1' }) },
  };
  const db = {
    payment: { findUnique: jest.fn().mockResolvedValue(null) },
    $transaction: jest.fn().mockImplementation((fn: (t: unknown) => unknown) => fn(tx)),
  };
  const availability = {
    assertSlotAvailable: jest.fn().mockResolvedValue({
      teacher: { approvedTrialPrice: 250_000, approvedRegularPrice: 500_000, policy: { rules: {} } },
      endsAt: new Date(),
    }),
  };
  const queue = { scheduleBooking: jest.fn(), scheduleExpiration: jest.fn() };
  const svc = new BookingsService(
    db as never,
    {} as never,
    redis as never,
    queue as never,
    availability as never,
    { reserve: jest.fn() } as never,
    settings as never,
    { walletBalance: jest.fn().mockResolvedValue(1_000_000), ledger: jest.fn() } as never,
    { evaluate: jest.fn().mockResolvedValue(null) } as never,
    { enqueue: jest.fn() } as never,
  );
  return { svc, tx, redis, settings, availability };
}

const book = (hoursAhead: number, over: Record<string, unknown> = {}) => ({
  teacherId: TEACHER,
  startsAt: new Date(Date.now() + hoursAhead * HOUR_MS).toISOString(),
  type: 'trial' as const,
  policyAccepted: true,
  timezone: 'Asia/Tehran',
  ...over,
});

describe('booking window', () => {
  it('rejects a lesson booked inside the minimum lead time', async () => {
    // Previously only "must be in the future" was checked server-side, so a
    // direct API call could book a lesson starting in one minute.
    const h = harness();
    await expect(h.svc.create(STUDENT, book(1))).rejects.toMatchObject({
      response: { code: 'BOOKING_LEAD_TIME_TOO_SHORT' },
    });
    expect(h.redis.lock).not.toHaveBeenCalled();
  });

  it('accepts a lesson beyond the minimum lead time', async () => {
    const h = harness();
    await expect(h.svc.create(STUDENT, book(4))).resolves.toMatchObject({ id: 'booking-new' });
  });

  it('honours a lead time configured in settings', async () => {
    const h = harness({ settings: { 'booking.minLeadMinutes': 600 } });
    await expect(h.svc.create(STUDENT, book(4))).rejects.toMatchObject({
      response: { code: 'BOOKING_LEAD_TIME_TOO_SHORT' },
    });
  });

  it('rejects a lesson beyond the maximum advance window', async () => {
    const h = harness();
    await expect(h.svc.create(STUDENT, book(24 * 400))).rejects.toMatchObject({
      response: { code: 'BOOKING_TOO_FAR_AHEAD' },
    });
  });
});

describe('optional trial session', () => {
  it('allows a regular lesson without a prior trial', async () => {
    const h = harness();
    await expect(h.svc.create(STUDENT, book(4, { type: 'regular' }))).resolves.toMatchObject({ id: 'booking-new' });
  });

  it('refuses a second trial with the same teacher', async () => {
    const h = harness({ counts: { trialUsed: 1 } });
    await expect(h.svc.create(STUDENT, book(4))).rejects.toMatchObject({
      response: { code: 'TRIAL_ALREADY_USED' },
    });
  });

  it('allows a trial when no prior trial exists', async () => {
    const h = harness({ counts: { trialUsed: 0 } });
    await expect(h.svc.create(STUDENT, book(4))).resolves.toMatchObject({ id: 'booking-new' });
  });
});
