/**
 * Financial invariants (AUDIT/01-financial.md §1.6).
 *
 * These assert the *arithmetic laws* the money domain relies on, independently
 * of any database. They are written to fail loudly if someone ever changes a
 * rounding rule, re-derives a total a different way, or introduces float money.
 *
 * The formulas are duplicated from the services on purpose: a test that imports
 * the implementation and re-runs it proves nothing about whether the rule is
 * right. These encode the rule the audit verified by hand.
 */

function splitPayment(subtotal: number, discountAmount: number, walletAmount: number) {
  const amount = subtotal - discountAmount;
  return { amount, gatewayAmount: amount - walletAmount };
}

function splitEarning(gross: number, percent: number) {
  const commissionAmount = Math.round((gross * percent) / 100);
  return { grossAmount: gross, commissionAmount, netAmount: gross - commissionAmount };
}

function discountFor(type: 'percent' | 'fixed', value: number, subtotal: number, maxAmount?: number) {
  const raw = type === 'percent' ? Math.round((subtotal * value) / 100) : value;
  const capped = maxAmount != null ? Math.min(raw, maxAmount) : raw;
  return Math.max(0, Math.min(subtotal, capped));
}

// A spread wide enough to expose rounding drift, including primes and values
// that are not multiples of the commission rate.
const AMOUNTS = [1, 7, 99, 333_333, 500_000, 1_250_000, 999_999, 12_345_678];
const PERCENTS = [0, 1, 3, 7, 15, 20, 33, 50, 99, 100];

describe('I2/I3 — payment decomposition', () => {
  it('always satisfies amount = subtotal - discount and gateway = amount - wallet', () => {
    for (const subtotal of AMOUNTS) {
      for (const discount of [0, 1, Math.floor(subtotal / 3), subtotal]) {
        const wallet = Math.floor((subtotal - discount) / 2);
        const { amount, gatewayAmount } = splitPayment(subtotal, discount, wallet);
        expect(amount).toBe(subtotal - discount);
        expect(gatewayAmount + wallet).toBe(amount);
        expect(gatewayAmount).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('never produces a fractional amount', () => {
    for (const subtotal of AMOUNTS) {
      const { amount, gatewayAmount } = splitPayment(subtotal, 1, 1);
      expect(Number.isInteger(amount)).toBe(true);
      expect(Number.isInteger(gatewayAmount)).toBe(true);
    }
  });
});

describe('I4 — commission split', () => {
  it('always sums back to gross, with no rial lost or created', () => {
    for (const gross of AMOUNTS) {
      for (const percent of PERCENTS) {
        const { commissionAmount, netAmount } = splitEarning(gross, percent);
        // The whole point: net is derived by subtraction, never rounded
        // separately. Rounding both halves independently is how platforms
        // silently lose or mint money.
        expect(commissionAmount + netAmount).toBe(gross);
        expect(Number.isInteger(commissionAmount)).toBe(true);
        expect(Number.isInteger(netAmount)).toBe(true);
      }
    }
  });

  it('never pays the teacher more than gross or less than nothing', () => {
    for (const gross of AMOUNTS) {
      for (const percent of PERCENTS) {
        const { commissionAmount, netAmount } = splitEarning(gross, percent);
        expect(netAmount).toBeGreaterThanOrEqual(0);
        expect(netAmount).toBeLessThanOrEqual(gross);
        expect(commissionAmount).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('takes no commission at 0% and the whole lesson at 100%', () => {
    expect(splitEarning(500_000, 0)).toMatchObject({ commissionAmount: 0, netAmount: 500_000 });
    expect(splitEarning(500_000, 100)).toMatchObject({ commissionAmount: 500_000, netAmount: 0 });
  });
});

describe('discount rules', () => {
  it('never discounts more than the subtotal', () => {
    for (const subtotal of AMOUNTS) {
      expect(discountFor('fixed', subtotal * 10, subtotal)).toBe(subtotal);
      expect(discountFor('percent', 100, subtotal)).toBe(subtotal);
      expect(discountFor('percent', 500, subtotal)).toBe(subtotal);
    }
  });

  it('never produces a negative discount', () => {
    for (const subtotal of AMOUNTS) {
      expect(discountFor('fixed', -1, subtotal)).toBe(0);
      expect(discountFor('percent', -50, subtotal)).toBe(0);
    }
  });

  it('honours maxAmount as a ceiling', () => {
    expect(discountFor('percent', 50, 1_000_000, 100_000)).toBe(100_000);
    expect(discountFor('fixed', 900_000, 1_000_000, 100_000)).toBe(100_000);
  });

  /**
   * MIG-001 hazard, pinned as a test. `Discount.value` and `DiscountRule.value`
   * share one Int column whose meaning depends on `type`: a percentage for
   * 'percent', a money amount otherwise. Any migration that scales money must
   * therefore be conditional -- scaling a percent turns 20% into 200%.
   */
  it('treats value as a percentage or an amount depending on type', () => {
    expect(discountFor('percent', 20, 1_000_000)).toBe(200_000);
    expect(discountFor('fixed', 20, 1_000_000)).toBe(20);
  });
});

describe('I1 — money is integral', () => {
  it('keeps every derived figure an integer across the whole grid', () => {
    for (const subtotal of AMOUNTS) {
      for (const percent of PERCENTS) {
        const discount = discountFor('percent', percent, subtotal);
        const { amount, gatewayAmount } = splitPayment(subtotal, discount, 0);
        const { commissionAmount, netAmount } = splitEarning(amount, percent);
        for (const v of [discount, amount, gatewayAmount, commissionAmount, netAmount]) {
          expect(Number.isInteger(v)).toBe(true);
        }
      }
    }
  });
});
