import { PricingService } from './pricing.service';
import { ReviewsService } from './reviews.service';

describe('Teacher pricing approval', () => {
  it('publishes only the final admin-approved prices and records history', async () => {
    const tx = {
      teacher: {
        // Trial is half the regular price, which is what `validatePrices` now enforces.
        findUnique: jest.fn().mockResolvedValue({ id: 'teacher-1', userId: 'teacher-user', proposedTrialPrice: 250000, proposedRegularPrice: 500000, approvedTrialPrice: null, approvedRegularPrice: null, priceStatus: 'UNDER_REVIEW' }),
        update: jest.fn().mockResolvedValue({ id: 'teacher-1', priceStatus: 'APPROVED' }),
      },
      teacherPriceHistory: { create: jest.fn() }, auditLog: { create: jest.fn() }, notification: { create: jest.fn() },
    };
    const service = new PricingService({ $transaction: jest.fn((callback) => callback(tx)) } as any);
    await service.review('admin-1', ['ADMIN'], 'teacher-1', { action: 'approve', note: 'Approved' });
    expect(tx.teacher.update).toHaveBeenCalledWith({ where: { id: 'teacher-1' }, data: expect.objectContaining({ priceStatus: 'APPROVED', approvedTrialPrice: 250000, approvedRegularPrice: 500000 }) });
    expect(tx.teacherPriceHistory.create).toHaveBeenCalled();
    expect(tx.auditLog.create).toHaveBeenCalled();
  });
});

describe('Teacher review eligibility', () => {
  it('rejects a review before a successfully completed class', async () => {
    const settings = { numeric: jest.fn().mockImplementation((_k: string, fallback: number) => Promise.resolve(fallback)) } as any;
    const service = new ReviewsService({ booking: { findUnique: jest.fn().mockResolvedValue({ studentId: 'student-1', status: 'CONFIRMED', attendanceTeacher: null, attendanceStudent: null, review: null }) } } as any, settings);
    await expect(service.create('student-1', 'booking-1', 5, 'Good')).rejects.toMatchObject({ response: expect.objectContaining({ code: 'REVIEW_REQUIRES_COMPLETED_CLASS' }) });
  });
});

describe('Teacher counter-offer acceptance', () => {
  it('moves the counter prices into a new proposal, clears the counter, and records an audit event', async () => {
    const tx = {
      teacher: {
        findUnique: jest.fn().mockResolvedValue({ id: 'teacher-1', userId: 'teacher-user', priceStatus: 'COUNTER_OFFER', counterTrialPrice: 260000, counterRegularPrice: 520000 }),
        update: jest.fn().mockResolvedValue({ id: 'teacher-1', priceStatus: 'SUBMITTED' }),
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
        counterTrialPrice: null,
        counterRegularPrice: null,
        priceStatus: 'SUBMITTED',
      }),
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'teacher.price.counter.accepted', entityId: 'teacher-1' }),
    }));
  });
});
