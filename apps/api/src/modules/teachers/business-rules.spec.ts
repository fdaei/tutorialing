import { PricingService, expectedTrialPrice } from './pricing.service';
import { ReviewsService } from './reviews.service';

const settingsStub = (over: Record<string, number> = {}) => ({
  numeric: jest.fn().mockImplementation((key: string, fallback: number) => Promise.resolve(over[key] ?? fallback)),
});

describe('trial price is half the regular price', () => {
  const propose = (trial: number, regular: number) => {
    const tx = {
      teacher: {
        findUnique: jest.fn().mockResolvedValue({ id: 'teacher-1', userId: 'teacher-user', priceStatus: 'DRAFT' }),
        update: jest.fn().mockResolvedValue({ id: 'teacher-1' }),
      },
      teacherPriceHistory: { create: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    const svc = new PricingService({ $transaction: jest.fn((cb: (t: unknown) => unknown) => cb(tx)) } as never);
    return { run: () => svc.propose('teacher-user', trial, regular), tx };
  };

  it('accepts a trial priced at exactly half', async () => {
    const { run, tx } = propose(250_000, 500_000);
    await run();
    expect(tx.teacher.update).toHaveBeenCalled();
  });

  it('rejects a trial priced at the full lesson rate', async () => {
    // Only `regular >= trial` was checked, so the trial discount could vanish.
    await expect(propose(500_000, 500_000).run()).rejects.toMatchObject({
      response: { code: 'TRIAL_PRICE_NOT_HALF_REGULAR' },
    });
  });

  it('rejects a trial priced below half', async () => {
    await expect(propose(100_000, 500_000).run()).rejects.toMatchObject({
      response: { code: 'TRIAL_PRICE_NOT_HALF_REGULAR' },
    });
  });

  it('rounds down so an odd regular price still has a whole-number trial', () => {
    expect(expectedTrialPrice(500_001)).toBe(250_000);
  });
});

describe('automatic deactivation after repeated one-star reviews', () => {
  /** The deactivation write, as distinct from the rating refresh. */
  const DEACTIVATION = { where: { id: 'teacher-1' }, data: { status: 'REJECTED' } };

  function harness(options: { oneStars: number; status?: string; threshold?: number }) {
    const tx = {
      review: {
        findUnique: jest.fn().mockResolvedValue({ id: 'review-1', moderationStatus: 'PENDING' }),
        update: jest.fn().mockResolvedValue({ id: 'review-1', teacherId: 'teacher-1', studentId: 'student-1', rating: 1 }),
        aggregate: jest.fn().mockResolvedValue({ _avg: { rating: 1 }, _count: { _all: options.oneStars } }),
        count: jest.fn().mockResolvedValue(options.oneStars),
      },
      teacher: {
        findUnique: jest.fn().mockResolvedValue({ id: 'teacher-1', userId: 'teacher-user', status: options.status ?? 'APPROVED' }),
        update: jest.fn().mockResolvedValue({}),
      },
      notification: { create: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    const settings = settingsStub(options.threshold ? { 'reviews.autoDeactivateOneStarCount': options.threshold } : {});
    const svc = new ReviewsService({ $transaction: jest.fn((cb: (t: unknown) => unknown) => cb(tx)) } as never, settings as never);
    return { svc, tx };
  }

  it('leaves the teacher active at the threshold', async () => {
    const h = harness({ oneStars: 5 });
    await h.svc.moderate('admin-1', 'review-1', 'APPROVED');
    expect(h.tx.teacher.update).not.toHaveBeenCalledWith(DEACTIVATION);
  });

  it('deactivates once the threshold is exceeded', async () => {
    const h = harness({ oneStars: 6 });
    await h.svc.moderate('admin-1', 'review-1', 'APPROVED');
    expect(h.tx.teacher.update).toHaveBeenCalledWith(DEACTIVATION);
  });

  it('records the reason in the audit log and tells the teacher', async () => {
    const h = harness({ oneStars: 6 });
    await h.svc.moderate('admin-1', 'review-1', 'APPROVED');
    expect(h.tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: 'teacher.auto_deactivated',
        after: expect.objectContaining({ reason: 'one_star_review_threshold', oneStarCount: 6 }),
      }),
    }));
    expect(h.tx.notification.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ type: 'TEACHER_AUTO_DEACTIVATED', userId: 'teacher-user' }),
    }));
  });

  it('honours a threshold configured by support', async () => {
    const h = harness({ oneStars: 3, threshold: 2 });
    await h.svc.moderate('admin-1', 'review-1', 'APPROVED');
    expect(h.tx.teacher.update).toHaveBeenCalledWith(DEACTIVATION);
  });

  it('does not re-deactivate an already rejected teacher', async () => {
    const h = harness({ oneStars: 9, status: 'REJECTED' });
    await h.svc.moderate('admin-1', 'review-1', 'APPROVED');
    expect(h.tx.teacher.update).not.toHaveBeenCalledWith(DEACTIVATION);
    expect(h.tx.auditLog.create).not.toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'teacher.auto_deactivated' }),
    }));
  });

  it('ignores a rejected one-star review, so the rule cannot be gamed', async () => {
    // Only approved, published one-stars count toward the threshold.
    const h = harness({ oneStars: 9 });
    await h.svc.moderate('admin-1', 'review-1', 'REJECTED', 'spam');
    expect(h.tx.teacher.update).not.toHaveBeenCalledWith(DEACTIVATION);
  });
});
