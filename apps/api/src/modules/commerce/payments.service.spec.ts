import { PaymentsService } from './payments.service';

const USER = 'student-1';
const BOOKING = { id: 'booking-1', studentId: USER, status: 'PENDING_PAYMENT', type: 'trial', price: 250_000, startsAt: new Date('2026-08-01T10:00:00Z') };

type Harness = ReturnType<typeof harness>;

function harness(options: { heldPayment?: Record<string, unknown> | null; existingByKey?: Record<string, unknown> | null } = {}) {
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
  const svc = new PaymentsService(db as never, queue as never, {} as never, wallet as never, autoDiscounts as never);
  return { svc, db, tx, queue, wallet, autoDiscounts, created };
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
  it('charges the price snapshotted on the booking', async () => {
    // Reading the teacher's live rate here re-quoted the student whenever the
    // teacher edited their price, and used the unapproved draft value.
    const h = harness();
    await h.svc.createPayment(USER, pay());
    expect(lastCreated(h)).toMatchObject({ subtotal: BOOKING.price, amount: BOOKING.price });
    expect(h.tx.booking.findUnique).toHaveBeenCalledWith({ where: { id: BOOKING.id } });
  });

  it('returns the original payment when an idempotency key is replayed', async () => {
    const h = harness({ existingByKey: { id: 'payment-old', userId: USER, status: 'PENDING', bookingId: BOOKING.id } });
    await expect(h.svc.createPayment(USER, pay())).resolves.toMatchObject({ id: 'payment-old' });
    expect(h.db.$transaction).not.toHaveBeenCalled();
  });

  it('does not hand another user their payment via a guessed key', async () => {
    const h = harness({ existingByKey: { id: 'payment-old', userId: 'someone-else', status: 'PENDING' } });
    await expect(h.svc.createPayment(USER, pay())).rejects.toMatchObject({
      response: { code: 'PAYMENT_KEY_CONFLICT' },
    });
  });

  it('frees the unique booking slot held by a failed attempt so the student can retry', async () => {
    // Payment.bookingId is unique: without detaching the failed row every retry
    // collided with the index and the booking became unpayable.
    const h = harness({ heldPayment: { id: 'payment-failed', status: 'FAILED', bookingId: BOOKING.id } });
    await h.svc.createPayment(USER, pay());
    expect(h.tx.payment.update).toHaveBeenCalledWith({ where: { id: 'payment-failed' }, data: { bookingId: null } });
    expect(h.tx.payment.create).toHaveBeenCalled();
  });

  it('refuses to start a second payment while one is still live', async () => {
    const h = harness({ heldPayment: { id: 'payment-pending', status: 'PENDING', bookingId: BOOKING.id } });
    await expect(h.svc.createPayment(USER, pay({ idempotencyKey: 'key-2' }))).rejects.toMatchObject({
      response: { code: 'BOOKING_PAYMENT_EXISTS' },
    });
    expect(h.tx.payment.create).not.toHaveBeenCalled();
  });

  it('refuses to re-charge a booking that is already paid', async () => {
    const h = harness({ heldPayment: { id: 'payment-paid', status: 'PAID', bookingId: BOOKING.id } });
    await expect(h.svc.createPayment(USER, pay({ idempotencyKey: 'key-3' }))).rejects.toMatchObject({
      response: { code: 'BOOKING_PAYMENT_EXISTS' },
    });
  });

  it('records which discount it reserved so the use can be released later', async () => {
    const h = harness();
    h.tx.discount.findFirst.mockResolvedValue({ id: 'discount-1', type: 'percent', value: 10, maxUses: 5, usedCount: 0 });
    await h.svc.createPayment(USER, pay({ discountCode: 'WELCOME' }));
    expect(h.tx.discount.update).toHaveBeenCalledWith({ where: { id: 'discount-1' }, data: { usedCount: { increment: 1 } } });
    expect(lastCreated(h)).toMatchObject({ discountId: 'discount-1', discountAmount: 25_000, amount: 225_000 });
  });

  it('refuses to spend wallet funds a concurrent payment already took', async () => {
    // The balance read and the debit are separate statements. Serializable
    // isolation is the primary guard; this asserts the ledger backstop that
    // refuses to leave the balance negative regardless of isolation.
    const h = harness();
    h.wallet.walletBalance
      .mockResolvedValueOnce(100_000) // pre-flight check passes
      .mockResolvedValueOnce(-50_000); // re-read after the debit: funds were taken
    await expect(h.svc.createPayment(USER, pay({ walletAmount: 100_000 }))).rejects.toMatchObject({
      response: { code: 'WALLET_BALANCE_CONFLICT' },
    });
  });

  it('rejects a wallet amount above the balance with a field-level message', async () => {
    const h = harness();
    h.wallet.walletBalance.mockResolvedValue(10_000);
    await expect(h.svc.createPayment(USER, pay({ walletAmount: 50_000 }))).rejects.toMatchObject({
      response: { code: 'WALLET_AMOUNT_INVALID' },
    });
  });
});

/**
 * A gateway callback can arrive after the 15-minute payment window closed and
 * the expiry job cancelled the booking — by then the slot may already belong to
 * another student. Confirming it double-booked the teacher and, because expiry
 * had already returned the wallet portion, let the student keep both the refund
 * and the class.
 */
function callbackHarness(options: { paymentStatus?: string; bookingStatus?: string | null; walletAmount?: number; walletCreditsSeen?: number } = {}) {
  const payment = {
    id: 'payment-1',
    userId: USER,
    purpose: 'booking',
    referenceId: BOOKING.id,
    bookingId: BOOKING.id,
    status: options.paymentStatus ?? 'PENDING',
    amount: 250_000,
    gatewayAmount: 250_000 - (options.walletAmount ?? 0),
    walletAmount: options.walletAmount ?? 0,
    discountId: null,
  };
  const booking = options.bookingStatus === null ? null : { ...BOOKING, status: options.bookingStatus ?? 'PENDING_PAYMENT' };
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
    walletEntry: { count: jest.fn().mockResolvedValue(options.walletCreditsSeen ?? 0), upsert: jest.fn().mockResolvedValue({}) },
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
  const svc = new PaymentsService(db as never, queue as never, gateway as never, { ledger: jest.fn() } as never, { evaluate: jest.fn().mockResolvedValue(null) } as never);
  return { svc, db, tx, gateway, queue, payment };
}

describe('PaymentsService.callback', () => {
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
    expect(h.tx.refund.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { idempotencyKey: 'late-capture:payment-1' },
      create: expect.objectContaining({ amount: 250_000, status: 'completed' }),
    }));
    expect(h.tx.walletEntry.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ direction: 'CREDIT', amount: 250_000 }),
    }));
    expect(h.payment.status).toBe('REFUNDED');
  });

  it('does not return the wallet portion twice when expiry already credited it', async () => {
    // expireBooking credits `walletAmount` back when it cancels the booking, so
    // only the gateway capture is outstanding by the time this callback lands.
    const h = callbackHarness({ paymentStatus: 'EXPIRED', bookingStatus: 'CANCELLED', walletAmount: 100_000, walletCreditsSeen: 1 });
    await h.svc.callback('auth-1', 'OK');
    expect(h.tx.refund.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ amount: 150_000 }),
    }));
  });

  it('returns both portions when nothing has been credited back yet', async () => {
    const h = callbackHarness({ paymentStatus: 'PENDING', bookingStatus: 'CANCELLED', walletAmount: 100_000, walletCreditsSeen: 0 });
    await h.svc.callback('auth-1', 'OK');
    expect(h.tx.refund.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ amount: 250_000 }),
    }));
  });

  it('schedules reminders only for a booking it actually confirmed', async () => {
    const confirmed = callbackHarness();
    await confirmed.svc.callback('auth-1', 'OK');
    expect(confirmed.queue.scheduleBooking).toHaveBeenCalled();

    const returned = callbackHarness({ paymentStatus: 'EXPIRED', bookingStatus: 'CANCELLED' });
    await returned.svc.callback('auth-1', 'OK');
    expect(returned.queue.scheduleBooking).not.toHaveBeenCalled();
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
});
