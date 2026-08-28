import { EarningsService } from './earnings.service';

const BOOKING = { id: 'booking-1', teacherId: 'teacher-1', price: 500_000 };

function harness(options: { commission?: unknown; holdDays?: unknown } = {}) {
  let earningState: Record<string, unknown> = {};
  const settings: Record<string, unknown> = {
    'commerce.commissionPercent': options.commission,
    'commerce.escrowHoldDays': options.holdDays,
  };
  const tx = {
    earning: {
      upsert: jest
        .fn()
        .mockImplementation(({ create }: { create: Record<string, unknown> }) => {
          earningState = { id: 'earning-1', ...create };
          return Promise.resolve(earningState);
        }),
      update: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(Object.assign(earningState, data)),
      ),
    },
    teacher: { findUniqueOrThrow: jest.fn().mockResolvedValue({ userId: 'teacher-user-1' }) },
    walletEntry: { upsert: jest.fn().mockResolvedValue({}) },
  };
  // Mirrors SettingsService.numeric: an unusable stored value falls back to the
  // caller's default rather than applying a nonsensical rule.
  const settingsService = {
    numeric: jest.fn().mockImplementation((key: string, fallback: number, max: number) => {
      const raw = settings[key];
      const value =
        typeof raw === 'number'
          ? raw
          : typeof raw === 'object' &&
              raw !== null &&
              !Array.isArray(raw) &&
              typeof (raw as Record<string, unknown>).value === 'number'
            ? (raw as { value: number }).value
            : undefined;
      if (value === undefined || !Number.isFinite(value) || value < 0 || value > max) return Promise.resolve(fallback);
      return Promise.resolve(value);
    }),
  };
  const svc = new EarningsService({} as never, settingsService as never);
  return { svc, tx };
}

describe('EarningsService.accrue', () => {
  it('credits the teacher net of the default commission when no setting exists', async () => {
    const h = harness();
    const earning = await h.svc.accrue(h.tx as never, BOOKING);
    expect(earning).toMatchObject({ grossAmount: 500_000, commissionAmount: 100_000, netAmount: 400_000 });
  });

  it('uses the commission percentage configured in the admin panel', async () => {
    // Previously hardcoded at 20%, which made the admin commission screen inert.
    const h = harness({ commission: 30 });
    const earning = await h.svc.accrue(h.tx as never, BOOKING);
    expect(earning).toMatchObject({ commissionAmount: 150_000, netAmount: 350_000 });
  });

  it('accepts the wrapped {value} shape an admin write may leave in the Json column', async () => {
    const h = harness({ commission: { value: 10 } });
    const earning = await h.svc.accrue(h.tx as never, BOOKING);
    expect(earning).toMatchObject({ commissionAmount: 50_000 });
  });

  it('falls back to the default when the stored setting is unusable', async () => {
    for (const commission of ['thirty', -5, 140, null, []]) {
      const h = harness({ commission });
      const earning = await h.svc.accrue(h.tx as never, BOOKING);
      expect(earning).toMatchObject({ commissionAmount: 100_000 });
    }
  });

  it('credits the net amount to the teacher wallet so escrow actually reaches them', async () => {
    // The completion path only ever wrote an Earning row; a teacher's wallet
    // balance stayed at zero no matter how many lessons they taught.
    const h = harness();
    await h.svc.accrue(h.tx as never, BOOKING);
    expect(h.tx.walletEntry.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { idempotencyKey: 'earning-credit:earning-1' },
        create: expect.objectContaining({
          userId: 'teacher-user-1',
          account: 'user_wallet',
          direction: 'CREDIT',
          amount: 400_000,
        }),
      }),
    );
  });

  it('keys both writes on the booking so replaying a completion cannot pay twice', async () => {
    const h = harness();
    await h.svc.accrue(h.tx as never, BOOKING);
    expect(h.tx.earning.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { bookingId: BOOKING.id },
        update: {},
      }),
    );
    expect(h.tx.walletEntry.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: {} }));
  });

  it('holds the earning for the configured dispute window before it is payable', async () => {
    const h = harness({ holdDays: 3 });
    const earning = await h.svc.accrue(h.tx as never, BOOKING);
    const heldDays = (earning.eligibleAt.getTime() - Date.now()) / 86_400_000;
    expect(heldDays).toBeGreaterThan(2.9);
    expect(heldDays).toBeLessThan(3.1);
  });

  it('skips the wallet credit when commission consumes the whole price', async () => {
    const h = harness({ commission: 100 });
    await h.svc.accrue(h.tx as never, BOOKING);
    expect(h.tx.walletEntry.upsert).not.toHaveBeenCalled();
  });
});
