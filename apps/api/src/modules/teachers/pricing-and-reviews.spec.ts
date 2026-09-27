import { PricingService } from './pricing.service';
import { ReviewsService } from './reviews.service';

describe('Teacher pricing approval', () => {
  it('lets an authorized admin start review and make the first monetary offer', async () => {
    const tx = {
      teacher: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'teacher-1', userId: 'teacher-user', priceStatus: 'UNDER_REVIEW',
          proposedTrialPrice: null, proposedRegularPrice: null,
        }),
        update: jest.fn().mockResolvedValue({ id: 'teacher-1', priceStatus: 'COUNTER_OFFER' }),
      },
      teacherPriceHistory: { create: jest.fn().mockResolvedValue({}) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      notification: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = new PricingService({ $transaction: jest.fn((callback) => callback(tx)) } as never);

    await service.review('admin-1', ['ADMIN'], 'teacher-1', {
      action: 'counter', counterTrialPrice: 250_000, counterRegularPrice: 500_000, note: 'پیشنهاد اولیه مدیریت',
    });

    expect(tx.teacher.update).toHaveBeenCalledWith({
      where: { id: 'teacher-1' },
      data: expect.objectContaining({
        priceStatus: 'COUNTER_OFFER', counterTrialPrice: 250_000, counterRegularPrice: 500_000,
      }),
    });
  });

  it('publishes only the final admin-approved prices and records history', async () => {
    const tx = {
      teacher: {
        // Trial is half the regular price, which is what `validatePrices` now enforces.
        findUnique: jest.fn().mockResolvedValue({
          id: 'teacher-1',
          userId: 'teacher-user',
          proposedTrialPrice: 250000,
          proposedRegularPrice: 500000,
          approvedTrialPrice: null,
          approvedRegularPrice: null,
          priceStatus: 'UNDER_REVIEW',
        }),
        update: jest.fn().mockResolvedValue({ id: 'teacher-1', priceStatus: 'APPROVED' }),
      },
      teacherPriceHistory: { create: jest.fn() },
      auditLog: { create: jest.fn() },
      notification: { create: jest.fn() },
    };
    const service = new PricingService({ $transaction: jest.fn((callback) => callback(tx)) } as any);
    await service.review('admin-1', ['ADMIN'], 'teacher-1', { action: 'approve', note: 'Approved' });
    expect(tx.teacher.update).toHaveBeenCalledWith({
      where: { id: 'teacher-1' },
      data: expect.objectContaining({
        priceStatus: 'APPROVED',
        approvedTrialPrice: 250000,
        approvedRegularPrice: 500000,
      }),
    });
    expect(tx.teacherPriceHistory.create).toHaveBeenCalled();
    expect(tx.auditLog.create).toHaveBeenCalled();
  });
});

describe('Teacher review eligibility', () => {
  it('rejects a review before a successfully completed class', async () => {
    const settings = {
      numeric: jest.fn().mockImplementation((_k: string, fallback: number) => Promise.resolve(fallback)),
    } as any;
    const service = new ReviewsService(
      {
        booking: {
          findUnique: jest.fn().mockResolvedValue({
            studentId: 'student-1',
            status: 'CONFIRMED',
            attendanceTeacher: null,
            attendanceStudent: null,
            review: null,
          }),
        },
      } as any,
      settings,
    );
    await expect(service.create('student-1', 'booking-1', 5, 'Good')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'REVIEW_REQUIRES_COMPLETED_CLASS' }),
    });
  });
});

describe('Teacher review replies', () => {
  it('lets the reviewed teacher reply to their own published review', async () => {
    const db = {
      review: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'review-1',
          teacherId: 'teacher-1',
          moderationStatus: 'APPROVED',
          teacher: { userId: 'teacher-user' },
        }),
        update: jest.fn().mockResolvedValue({ id: 'review-1', teacherResponse: 'Thank you!' }),
      },
    } as any;
    const service = new ReviewsService(db, {} as any);

    await service.reply('teacher-user', 'review-1', '  Thank you!  ');

    expect(db.review.update).toHaveBeenCalledWith({
      where: { id: 'review-1' },
      data: { teacherResponse: 'Thank you!', respondedAt: expect.any(Date) },
    });
  });

  it('rejects a reply from a teacher who was not reviewed', async () => {
    const db = {
      review: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'review-1',
          teacherId: 'teacher-1',
          moderationStatus: 'APPROVED',
          teacher: { userId: 'other-teacher-user' },
        }),
      },
    } as any;
    const service = new ReviewsService(db, {} as any);

    await expect(service.reply('teacher-user', 'review-1', 'Nice try')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'REVIEW_REPLY_FORBIDDEN' }),
    });
  });

  it('rejects a reply to a review that is not published yet', async () => {
    const db = {
      review: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'review-1',
          teacherId: 'teacher-1',
          moderationStatus: 'PENDING',
          teacher: { userId: 'teacher-user' },
        }),
      },
    } as any;
    const service = new ReviewsService(db, {} as any);

    await expect(service.reply('teacher-user', 'review-1', 'Too early')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'REVIEW_NOT_PUBLISHED' }),
    });
  });
});

describe('Teacher own review listing', () => {
  it('lists only the calling teacher’s published, approved reviews', async () => {
    const rows = [{ id: 'review-1', rating: 5, comment: 'Great', teacherResponse: null }];
    const db = {
      teacher: { findUnique: jest.fn().mockResolvedValue({ id: 'teacher-1' }) },
      $transaction: jest.fn().mockResolvedValue([rows, 1]),
      review: { findMany: jest.fn(), count: jest.fn() },
    } as any;
    const service = new ReviewsService(db, {} as any);

    const result = await service.mine('teacher-user', 1, 20);

    expect(db.teacher.findUnique).toHaveBeenCalledWith({ where: { userId: 'teacher-user' }, select: { id: true } });
    expect(result).toEqual({ data: rows, total: 1, page: 1, limit: 20, totalPages: 1 });
  });

  it('rejects when the caller has no teacher profile', async () => {
    const db = { teacher: { findUnique: jest.fn().mockResolvedValue(null) } } as any;
    const service = new ReviewsService(db, {} as any);

    await expect(service.mine('not-a-teacher', 1, 20)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'TEACHER_NOT_FOUND' }),
    });
  });
});

describe('Teacher price proposal', () => {
  it('submits a valid proposal, clears any stale counter/note, and records history', async () => {
    const tx = {
      teacher: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'teacher-1',
          userId: 'teacher-user',
          priceStatus: 'DRAFT',
          counterTrialPrice: null,
          counterRegularPrice: null,
        }),
        update: jest.fn().mockResolvedValue({ id: 'teacher-1', priceStatus: 'SUBMITTED' }),
      },
      teacherPriceHistory: { create: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    const service = new PricingService({ $transaction: jest.fn((callback) => callback(tx)) } as never);

    await service.propose('teacher-user', 250000, 500000);

    expect(tx.teacher.update).toHaveBeenCalledWith({
      where: { id: 'teacher-1' },
      data: expect.objectContaining({
        proposedTrialPrice: 250000,
        proposedRegularPrice: 500000,
        counterTrialPrice: null,
        counterRegularPrice: null,
        priceStatus: 'SUBMITTED',
      }),
    });
    expect(tx.teacherPriceHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'teacher.price.proposed' }) }),
    );
  });

  it('rejects a trial price that is not exactly half the regular price', async () => {
    const service = new PricingService({} as never);
    await expect(service.propose('teacher-user', 300000, 500000)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'TRIAL_PRICE_NOT_HALF_REGULAR' }),
    });
  });

  it('rejects a new proposal while a management counter-offer is pending', async () => {
    const tx = {
      teacher: {
        findUnique: jest.fn().mockResolvedValue({ id: 'teacher-1', userId: 'teacher-user', priceStatus: 'COUNTER_OFFER' }),
      },
    };
    const service = new PricingService({ $transaction: jest.fn((callback) => callback(tx)) } as never);
    await expect(service.propose('teacher-user', 250000, 500000)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PRICE_COUNTER_OFFER_PENDING' }),
    });
  });
});

describe('Teacher counter-offer acceptance', () => {
  it('activates the agreed admin offer, clears the counter, and records an audit event', async () => {
    const tx = {
      teacher: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'teacher-1',
          userId: 'teacher-user',
          priceStatus: 'COUNTER_OFFER',
          counterTrialPrice: 260000,
          counterRegularPrice: 520000,
        }),
        update: jest.fn().mockResolvedValue({ id: 'teacher-1', priceStatus: 'APPROVED' }),
      },
      teacherPriceHistory: { create: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    const service = new PricingService({ $transaction: jest.fn((callback) => callback(tx)) } as any);

    await service.acceptCounter('teacher-user');

    expect(tx.teacher.update).toHaveBeenCalledWith({
      where: { id: 'teacher-1' },
      data: expect.objectContaining({
        proposedTrialPrice: 260000,
        proposedRegularPrice: 520000,
        approvedTrialPrice: 260000,
        approvedRegularPrice: 520000,
        trialPrice: 260000,
        regularPrice: 520000,
        counterTrialPrice: null,
        counterRegularPrice: null,
        priceStatus: 'APPROVED',
      }),
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'teacher.price.counter.accepted', entityId: 'teacher-1' }),
      }),
    );
  });
});

describe('Teacher negotiation request', () => {
  it('moves a platform counter-offer back under review and records the request', async () => {
    const tx = {
      teacher: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'teacher-1',
          userId: 'teacher-user',
          priceStatus: 'COUNTER_OFFER',
          proposedTrialPrice: 250000,
          proposedRegularPrice: 500000,
          counterTrialPrice: 260000,
          counterRegularPrice: 520000,
        }),
        update: jest.fn().mockResolvedValue({ id: 'teacher-1', priceStatus: 'UNDER_REVIEW' }),
      },
      teacherPriceHistory: { create: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    const service = new PricingService({ $transaction: jest.fn((callback) => callback(tx)) } as never);

    await service.requestNegotiation('teacher-user', 'Please review my experience.');

    expect(tx.teacher.update).toHaveBeenCalledWith({
      where: { id: 'teacher-1' },
      data: expect.objectContaining({ priceStatus: 'UNDER_REVIEW' }),
    });
    expect(tx.teacherPriceHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'teacher.negotiation.requested' }) }),
    );
  });
});
