import { AutoDiscountsService } from './auto-discounts.service';

const RULE = { id: 'rule-1', trigger: 'BIRTHDAY', type: 'percent', value: 20, maxAmount: 200_000, windowDays: 7, active: true };

/** A birth date is stored date-only at UTC midnight. */
const birth = (month: number, day: number) => new Date(Date.UTC(1995, month - 1, day));

function harness(options: { birthDate?: Date | null; timezone?: string; rules?: Record<string, unknown>[] } = {}) {
  const tx = {
    user: {
      findUnique: jest.fn().mockResolvedValue(
        options.birthDate === null
          ? { birthDate: null, timezone: options.timezone ?? 'Asia/Tehran' }
          : { birthDate: options.birthDate ?? birth(3, 21), timezone: options.timezone ?? 'Asia/Tehran' },
      ),
    },
    discountRule: { findMany: jest.fn().mockResolvedValue(options.rules ?? [RULE]) },
  };
  return { svc: new AutoDiscountsService({} as never), tx };
}

/** Freezes "today" so the birthday window is deterministic. */
const at = (iso: string) => jest.setSystemTime(new Date(iso));

describe('AutoDiscountsService.evaluate', () => {
  beforeAll(() => jest.useFakeTimers({ doNotFake: ['nextTick'] }));
  afterAll(() => jest.useRealTimers());

  it('applies the discount on the birthday itself', async () => {
    at('2026-03-21T09:00:00Z');
    const h = harness();
    await expect(h.svc.evaluate(h.tx as never, 'user-1', 500_000)).resolves.toMatchObject({ ruleId: 'rule-1', amount: 100_000 });
  });

  it('applies within the configured window on either side', async () => {
    const h = harness();
    at('2026-03-16T09:00:00Z'); // five days before
    await expect(h.svc.evaluate(h.tx as never, 'user-1', 500_000)).resolves.toMatchObject({ amount: 100_000 });
    at('2026-03-27T09:00:00Z'); // six days after
    await expect(h.svc.evaluate(h.tx as never, 'user-1', 500_000)).resolves.toMatchObject({ amount: 100_000 });
  });

  it('does not apply outside the window', async () => {
    at('2026-06-01T09:00:00Z');
    const h = harness();
    await expect(h.svc.evaluate(h.tx as never, 'user-1', 500_000)).resolves.toBeNull();
  });

  it('handles a birthday that wraps the end of the year', async () => {
    // A 1 January birthday must still match a window opening in late December.
    at('2026-12-28T09:00:00Z');
    const h = harness({ birthDate: birth(1, 1) });
    await expect(h.svc.evaluate(h.tx as never, 'user-1', 500_000)).resolves.toMatchObject({ amount: 100_000 });
  });

  it('caps a percentage rule at maxAmount', async () => {
    at('2026-03-21T09:00:00Z');
    const h = harness();
    // 20% of 5,000,000 is 1,000,000, above the 200,000 cap.
    await expect(h.svc.evaluate(h.tx as never, 'user-1', 5_000_000)).resolves.toMatchObject({ amount: 200_000 });
  });

  it('never discounts more than the subtotal', async () => {
    at('2026-03-21T09:00:00Z');
    const h = harness({ rules: [{ ...RULE, type: 'fixed', value: 900_000, maxAmount: null }] });
    await expect(h.svc.evaluate(h.tx as never, 'user-1', 100_000)).resolves.toMatchObject({ amount: 100_000 });
  });

  it('returns nothing when the student has no birth date on file', async () => {
    at('2026-03-21T09:00:00Z');
    const h = harness({ birthDate: null });
    await expect(h.svc.evaluate(h.tx as never, 'user-1', 500_000)).resolves.toBeNull();
    expect(h.tx.discountRule.findMany).not.toHaveBeenCalled();
  });

  it('returns nothing when no rule is configured', async () => {
    at('2026-03-21T09:00:00Z');
    const h = harness({ rules: [] });
    await expect(h.svc.evaluate(h.tx as never, 'user-1', 500_000)).resolves.toBeNull();
  });

  it('picks the most valuable applicable rule', async () => {
    at('2026-03-21T09:00:00Z');
    const h = harness({ rules: [RULE, { ...RULE, id: 'rule-2', value: 40, maxAmount: null }] });
    await expect(h.svc.evaluate(h.tx as never, 'user-1', 500_000)).resolves.toMatchObject({ ruleId: 'rule-2', amount: 200_000 });
  });

  it('falls back to the platform timezone when the stored one is malformed', async () => {
    // A bad timezone must not silently cost the student their discount.
    at('2026-03-21T09:00:00Z');
    const h = harness({ timezone: 'Not/AZone' });
    await expect(h.svc.evaluate(h.tx as never, 'user-1', 500_000)).resolves.toMatchObject({ amount: 100_000 });
  });
});
