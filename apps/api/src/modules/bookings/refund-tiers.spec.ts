import { refundTiers } from './bookings.service';

const tiers = [
  { beforeHours: 24, refundPercent: 100 },
  { beforeHours: 2, refundPercent: 50 },
];

describe('refundTiers', () => {
  it('returns tiers sorted from the most generous cut-off down', () => {
    expect(refundTiers({ tiers: [tiers[1], tiers[0]] })).toEqual([tiers[0], tiers[1]]);
  });

  it('survives every non-object shape the Json column can hold', () => {
    // Any of these previously threw inside the cancellation transaction, which
    // left the student unable to cancel at all.
    expect(refundTiers(null)).toEqual([]);
    expect(refundTiers([])).toEqual([]);
    expect(refundTiers('none')).toEqual([]);
    expect(refundTiers(7)).toEqual([]);
    expect(refundTiers({})).toEqual([]);
    expect(refundTiers({ tiers: null })).toEqual([]);
    expect(refundTiers({ tiers: 'all' })).toEqual([]);
  });

  it('drops malformed tiers instead of comparing against non-numbers', () => {
    expect(
      refundTiers({ tiers: [{ beforeHours: '24', refundPercent: 100 }, null, { beforeHours: 2 }, tiers[1]] }),
    ).toEqual([tiers[1]]);
  });
});
