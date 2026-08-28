import { Prisma } from '@prisma/client';
import { PaymentsService } from './payments.service';

const USER = 'student-1';
const BOOKING = {
  id: 'booking-1',
  studentId: USER,
  status: 'PENDING_PAYMENT',
  type: 'trial',
  price: 250_000,
  startsAt: new Date('2026-08-01T10:00:00Z'),
};

type Harness = ReturnType<typeof harness>;

function harness(
  options: { heldPayment?: Record<string, unknown> | null; existingByKey?: Record<string, unknown> | null } = {},
) {
  const created: Record<string, unknown>[] = [];
  const tx = {
    booking: { findUnique: jest.fn().mockResolvedValue(BOOKING) },
    payment: {
      findUnique: jest.fn().mockResolvedValue(options.heldPayment ?? null),
      update: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
        created.push(data);
        return Promise.resolve({ id: 'payment-new', ...data });
      }),
    },
    discount: { findFirst: jest.fn(), update: jest.fn() },
  };
  const db = {
    payment: { findUnique: jest.fn().mockResolvedValue(options.existingByKey ?? null) },
    booking: { findUnique: jest.fn().mockResolvedValue(BOOKING) },
    $transaction: jest.fn().mockImplementation((fn: (t: unknown) => unknown) => fn(tx)),
  };
  const wallet = { walletBalance: jest.fn().mockResolvedValue(0), ledger: jest.fn() };
  const queue = { scheduleBooking: jest.fn() };
  const autoDiscounts = { evaluate: jest.fn().mockResolvedValue(null) };
  const redis = { lock: jest.fn().mockResolvedValue({ token: 't', release: jest.fn() }) };
  const outbox = { enqueue: jest.fn().mockResolvedValue({}) };
  const svc = new PaymentsService(
    db as never,
    queue as never,
    {} as never,
    wallet as never,
    autoDiscounts as never,
    redis as never,
    outbox as never,
  );
  return { svc, db, tx, queue, wallet, autoDiscounts, redis, created, outbox };
}

const pay = (over: Record<string, unknown> = {}) => ({
  purpose: 'booking' as const,
  referenceId: BOOKING.id,
  walletAmount: 0,
  idempotencyKey: 'key-1',
  ...over,
});

const lastCreated = (h: Harness) => h.created[h.created.length - 1];

describe('PaymentsService.createPayment', () => {
  it('rejects every legacy booking checkout before creating a payment', async () => {
    const h = harness();
    await expect(h.svc.createPayment(USER, pay())).rejects.toMatchObject({
      response: { code: 'BOOKING_WALLET_PAYMENT_REQUIRED' },
    });
    expect(h.db.$transaction).not.toHaveBeenCalled();
    expect(h.tx.payment.create).not.toHaveBeenCalled();
  });
});

/**
 * A gateway callback can arrive after the 15-minute payment window closed and
 * the expiry job cancelled the booking — by then the slot may already belong to
 * another student. Confirming it double-booked the teacher and, because expiry
 * had already returned the wallet portion, let the student keep both the refund
 * and the class.
 */
function callbackHarness(
  options: {
    paymentStatus?: string;
    bookingStatus?: string | null;
    walletAmount?: number;
    walletCreditsSeen?: number;
    purpose?: string;
  } = {},
) {
  const payment = {
    id: 'payment-1',
    userId: USER,
    purpose: options.purpose ?? 'booking',
    referenceId: BOOKING.id,
    bookingId: BOOKING.id,
    status: options.paymentStatus ?? 'PENDING',
    amount: 250_000,
    gatewayAmount: 250_000 - (options.walletAmount ?? 0),
    walletAmount: options.walletAmount ?? 0,
    discountId: null,
  };
  const booking =
    options.bookingStatus === null ? null : { ...BOOKING, status: options.bookingStatus ?? 'PENDING_PAYMENT' };
  const tx = {
    payment: {
      findUniqueOrThrow: jest.fn().mockImplementation(() => Promise.resolve({ ...payment })),
      update: jest.fn().mockImplementation(({ data }: { data: { status?: string } }) => {
        if (data.status) payment.status = data.status;
        return Promise.resolve({ ...payment });
      }),
    },
    booking: {
      findUnique: jest.fn().mockImplementation(() => Promise.resolve(booking && { ...booking })),
      // Mirrors the real write so the post-commit re-read below sees CONFIRMED.
      update: jest.fn().mockImplementation(({ data }: { data: { status?: string } }) => {
        if (booking && data.status) booking.status = data.status;
        return Promise.resolve(booking);
      }),
    },
    walletEntry: {
      count: jest.fn().mockResolvedValue(options.walletCreditsSeen ?? 0),
      upsert: jest.fn().mockResolvedValue({}),
    },
    refund: { upsert: jest.fn().mockResolvedValue({ id: 'refund-1' }) },
    notification: { create: jest.fn().mockResolvedValue({}) },
    discount: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
  };
  const db = {
    payment: { findUnique: jest.fn().mockImplementation(() => Promise.resolve({ ...payment })) },
    booking: { findUnique: jest.fn().mockImplementation(() => Promise.resolve(booking && { ...booking })) },
    $transaction: jest.fn().mockImplementation((fn: (t: unknown) => unknown) => fn(tx)),
  };
  const gateway = { verify: jest.fn().mockResolvedValue({ ok: true, reference: 'REF-1' }) };
  const queue = { scheduleBooking: jest.fn() };
  const redis = { lock: jest.fn().mockResolvedValue({ token: 't', release: jest.fn() }) };
  const wallet = { ledger: jest.fn() };
  const outbox = { enqueue: jest.fn().mockResolvedValue({}) };
  const svc = new PaymentsService(
    db as never,
    queue as never,
    gateway as never,
    wallet as never,
    { evaluate: jest.fn().mockResolvedValue(null) } as never,
    redis as never,
    outbox as never,
  );
  return { svc, db, tx, gateway, queue, payment, wallet, outbox };
}

describe('PaymentsService.callback', () => {
  it('credits a wallet top-up only after the gateway verifies it', async () => {
    const h = callbackHarness({ purpose: 'wallet_top_up' });
    await h.svc.callback('auth-1', 'OK');
    expect(h.wallet.ledger).toHaveBeenCalledWith(
      h.tx,
      USER,
      'CREDIT',
      250_000,
      'wallet top-up',
      'Payment',
      'payment-1',
      'wallet-top-up:payment-1',
    );
    expect(h.tx.booking.update).not.toHaveBeenCalled();
  });

  it('confirms the booking on a normal in-window payment', async () => {
    const h = callbackHarness();
    await h.svc.callback('auth-1', 'OK');
    expect(h.tx.booking.update).toHaveBeenCalledWith({ where: { id: BOOKING.id }, data: { status: 'CONFIRMED' } });
    expect(h.tx.refund.upsert).not.toHaveBeenCalled();
  });

  it('does not confirm a booking the expiry job already cancelled', async () => {
    const h = callbackHarness({ paymentStatus: 'EXPIRED', bookingStatus: 'CANCELLED' });
    await h.svc.callback('auth-1', 'OK');
    expect(h.tx.booking.update).not.toHaveBeenCalled();
  });

  it('returns a late capture to the student wallet instead of the class', async () => {
    const h = callbackHarness({ paymentStatus: 'EXPIRED', bookingStatus: 'CANCELLED' });
    await h.svc.callback('auth-1', 'OK');
    expect(h.tx.refund.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { idempotencyKey: 'late-capture:payment-1' },
        create: expect.objectContaining({ amount: 250_000, status: 'completed' }),
      }),
    );
    expect(h.tx.walletEntry.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ direction: 'CREDIT', amount: 250_000 }),
      }),
    );
    expect(h.payment.status).toBe('REFUNDED');
  });

  it('does not return the wallet portion twice when expiry already credited it', async () => {
    // expireBooking credits `walletAmount` back when it cancels the booking, so
    // only the gateway capture is outstanding by the time this callback lands.
    const h = callbackHarness({
      paymentStatus: 'EXPIRED',
      bookingStatus: 'CANCELLED',
      walletAmount: 100_000,
      walletCreditsSeen: 1,
    });
    await h.svc.callback('auth-1', 'OK');
    expect(h.tx.refund.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ amount: 150_000 }),
      }),
    );
  });

  it('returns both portions when nothing has been credited back yet', async () => {
    const h = callbackHarness({
      paymentStatus: 'PENDING',
      bookingStatus: 'CANCELLED',
      walletAmount: 100_000,
      walletCreditsSeen: 0,
    });
    await h.svc.callback('auth-1', 'OK');
    expect(h.tx.refund.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ amount: 250_000 }),
      }),
    );
  });

  it('schedules reminders only for a booking it actually confirmed', async () => {
    const confirmed = callbackHarness();
    await confirmed.svc.callback('auth-1', 'OK');
    expect(confirmed.queue.scheduleBooking).toHaveBeenCalled();

    const returned = callbackHarness({ paymentStatus: 'EXPIRED', bookingStatus: 'CANCELLED' });
    await returned.svc.callback('auth-1', 'OK');
    expect(returned.queue.scheduleBooking).not.toHaveBeenCalled();
  });

  /**
   * FIN-301. The settling transaction commits the PAID payment and the
   * CONFIRMED booking; the enqueue that schedules the reminders is a separate
   * call afterwards. A queue that is unreachable for that half-second used to
   * throw out of `settleVerified` — reporting failure for a payment that had
   * succeeded, and losing the reminder for good, because every later retry sees
   * the payment already PAID and returns early.
   */
  it('records the confirmation in the outbox inside the settling transaction', async () => {
    const h = callbackHarness();
    await h.svc.callback('auth-1', 'OK');
    expect(h.outbox.enqueue).toHaveBeenCalledWith(
      h.tx,
      'BOOKING_CONFIRMED',
      `booking-confirmed:${BOOKING.id}`,
      { bookingId: BOOKING.id },
    );
  });

  it('still settles the payment when the queue is unreachable at commit time', async () => {
    const h = callbackHarness();
    h.queue.scheduleBooking.mockRejectedValue(new Error('ECONNREFUSED'));

    const payment = await h.svc.callback('auth-1', 'OK');

    // The capture is real money: it must be recorded whatever the queue is
    // doing. The outbox row is what the dispatcher picks up later.
    expect(payment).toBeDefined();
    expect(h.outbox.enqueue).toHaveBeenCalled();
  });

  it('does not record a confirmation for a booking it could not confirm', async () => {
    const h = callbackHarness({ paymentStatus: 'EXPIRED', bookingStatus: 'CANCELLED' });
    await h.svc.callback('auth-1', 'OK');
    expect(h.outbox.enqueue).not.toHaveBeenCalled();
  });

  it('leaves an already refunded payment alone rather than re-crediting it', async () => {
    const h = callbackHarness({ paymentStatus: 'REFUNDED' });
    await h.svc.callback('auth-1', 'OK');
    expect(h.gateway.verify).not.toHaveBeenCalled();
    expect(h.tx.walletEntry.upsert).not.toHaveBeenCalled();
  });

  it('is idempotent for an already paid payment', async () => {
    const h = callbackHarness({ paymentStatus: 'PAID' });
    await h.svc.callback('auth-1', 'OK');
    expect(h.gateway.verify).not.toHaveBeenCalled();
    expect(h.tx.booking.update).not.toHaveBeenCalled();
  });

  // LOAD-002: two genuinely simultaneous callbacks for one authority both enter
  // the Serializable transaction and Postgres aborts the loser. That abort used
  // to surface as a 409 for a payment that had in fact succeeded.
  it('retries once on a write conflict instead of surfacing a 409', async () => {
    const h = callbackHarness();
    const conflictError = new Prisma.PrismaClientKnownRequestError('write conflict', { code: 'P2034', clientVersion: '6' });
    h.db.$transaction.mockRejectedValueOnce(conflictError);
    await expect(h.svc.callback('auth-1', 'OK')).resolves.toMatchObject({ status: 'PAID' });
    expect(h.db.$transaction).toHaveBeenCalledTimes(2);
  });

  it('does not re-fulfil when the retry finds the winner already settled it', async () => {
    const h = callbackHarness();
    const conflictError = new Prisma.PrismaClientKnownRequestError('write conflict', { code: 'P2034', clientVersion: '6' });
    h.db.$transaction.mockRejectedValueOnce(conflictError);
    // The winning transaction committed REFUNDED (the slot was gone), so the
    // retry must leave it alone rather than flipping it back to PAID.
    h.payment.status = 'REFUNDED';
    await h.svc.callback('auth-1', 'OK');
    expect(h.tx.booking.update).not.toHaveBeenCalled();
    expect(h.tx.refund.upsert).not.toHaveBeenCalled();
  });

  it('gives up rather than retrying a non-conflict failure', async () => {
    const h = callbackHarness();
    h.db.$transaction.mockRejectedValue(new Error('connection lost'));
    await expect(h.svc.callback('auth-1', 'OK')).rejects.toThrow('connection lost');
    expect(h.db.$transaction).toHaveBeenCalledTimes(1);
  });
});

function gatewayRedirectHarness(
  payment: Record<string, unknown>,
  lockResult: unknown = { token: 't', release: jest.fn() },
) {
  payment = { purpose: 'wallet_top_up', gatewayAmount: 100_000, ...payment };
  const db = {
    payment: {
      // Mirrors real Prisma `findFirstOrThrow` semantics: the row is only
      // returned when the caller's `where` clause actually matches it,
      // rather than blanket-returning `payment` regardless of args — the
      // realism a SEC-210 ownership test depends on.
      findFirstOrThrow: jest.fn().mockImplementation(({ where }: { where: { id: string; userId: string } }) => {
        if (where.id === payment.id && where.userId === (payment.userId ?? 'user-1')) {
          return Promise.resolve(payment);
        }
        return Promise.reject(Object.assign(new Error('No Payment found'), { code: 'P2025' }));
      }),
      update: jest.fn().mockResolvedValue({}),
    },
  };
  const gateway = {
    request: jest.fn().mockResolvedValue({ authority: 'new-authority', url: 'https://gateway.example/new-authority' }),
    resumeUrl: jest.fn().mockImplementation((authority: string) => `https://gateway.example/${authority}`),
  };
  const redis = { lock: jest.fn().mockResolvedValue(lockResult) };
  const svc = new PaymentsService(
    db as never, {} as never, gateway as never, {} as never, {} as never, redis as never, {} as never,
  );
  return { svc, db, gateway, redis };
}

describe('PaymentsService.gatewayRedirect', () => {
  it('reuses the existing authority instead of opening a second Zarinpal session (FIN-002)', async () => {
    const h = gatewayRedirectHarness({ id: 'payment-1', authority: 'existing-authority' });
    const result = await h.svc.gatewayRedirect('user-1', 'payment-1');
    expect(h.gateway.request).not.toHaveBeenCalled();
    expect(h.db.payment.update).not.toHaveBeenCalled();
    expect(result).toEqual({ authority: 'existing-authority', url: 'https://gateway.example/existing-authority' });
  });

  it('requests a new authority and persists it for a wallet top-up', async () => {
    const h = gatewayRedirectHarness({ id: 'payment-1', authority: null });
    const result = await h.svc.gatewayRedirect('user-1', 'payment-1');
    expect(h.gateway.request).toHaveBeenCalledTimes(1);
    expect(h.db.payment.update).toHaveBeenCalledWith({
      where: { id: 'payment-1' },
      data: { authority: 'new-authority' },
    });
    expect(result).toEqual({ authority: 'new-authority', url: 'https://gateway.example/new-authority' });
  });

  it('rejects a concurrent call for the same payment instead of racing a second gateway session', async () => {
    const h = gatewayRedirectHarness({ id: 'payment-1', authority: null }, null);
    await expect(h.svc.gatewayRedirect('user-1', 'payment-1')).rejects.toMatchObject({
      response: { code: 'PAYMENT_GATEWAY_BUSY' },
    });
    expect(h.gateway.request).not.toHaveBeenCalled();
  });

  it('always releases the lock, even when the gateway call fails', async () => {
    const release = jest.fn();
    const h = gatewayRedirectHarness(
      { id: 'payment-1', authority: null },
      { token: 't', release },
    );
    h.gateway.request.mockRejectedValue(new Error('zarinpal down'));
    await expect(h.svc.gatewayRedirect('user-1', 'payment-1')).rejects.toThrow('zarinpal down');
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('rejects a booking gateway even if a legacy authority exists', async () => {
    const h = gatewayRedirectHarness({ id: 'payment-1', authority: 'legacy-authority', purpose: 'booking' });
    await expect(h.svc.gatewayRedirect('user-1', 'payment-1')).rejects.toMatchObject({
      response: { code: 'GATEWAY_ONLY_FOR_WALLET_TOP_UP' },
    });
    expect(h.gateway.request).not.toHaveBeenCalled();
  });

  /** SEC-210. User A owns the payment; User B (a different authenticated
   * user, not a role/permission gap) requests the same payment id. */
  it('rejects a different user requesting another user’s payment (IDOR)', async () => {
    const h = gatewayRedirectHarness({ id: 'payment-1', userId: 'user-a', authority: 'existing-authority' });
    await expect(h.svc.gatewayRedirect('user-b', 'payment-1')).rejects.toThrow();
    expect(h.gateway.request).not.toHaveBeenCalled();
  });

  it('still lets the owning user reach their own payment', async () => {
    const h = gatewayRedirectHarness({ id: 'payment-1', userId: 'user-a', authority: 'existing-authority' });
    const result = await h.svc.gatewayRedirect('user-a', 'payment-1');
    expect(result).toEqual({ authority: 'existing-authority', url: 'https://gateway.example/existing-authority' });
  });
});
