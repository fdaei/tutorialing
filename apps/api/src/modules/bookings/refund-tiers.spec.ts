import type { Prisma } from '@prisma/client';
import { refundTiers } from './bookings.service';

// The column is `Json`, so at runtime it can hold anything the writer put there.
// The casts are the point of these cases: they reproduce values TypeScript would
// never let the write path produce but the database happily returns.
const snapshot = (value: unknown) => refundTiers(value as Prisma.JsonValue);

const generous = { beforeHours: 24, refundPercent: 100 };
const partial = { beforeHours: 2, refundPercent: 50 };

describe('refundTiers', () => {
  it('returns tiers sorted from the most generous cut-off down', () => {
    expect(snapshot({ tiers: [partial, generous] })).toEqual([generous, partial]);
  });

  it('survives every non-object shape the Json column can hold', () => {
    // Any of these previously threw inside the cancellation transaction, which
    // left the student unable to cancel at all.
    expect(snapshot(null)).toEqual([]);
    expect(snapshot([])).toEqual([]);
    expect(snapshot('none')).toEqual([]);
    expect(snapshot(7)).toEqual([]);
    expect(snapshot({})).toEqual([]);
    expect(snapshot({ tiers: null })).toEqual([]);
    expect(snapshot({ tiers: 'all' })).toEqual([]);
  });

  it('drops malformed tiers instead of comparing against non-numbers', () => {
    const rows = [{ beforeHours: '24', refundPercent: 100 }, null, { beforeHours: 2 }, partial];
    expect(snapshot({ tiers: rows })).toEqual([partial]);
  });
});
