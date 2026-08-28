import { ReviewsService } from './reviews.service';

const settings = { numeric: jest.fn().mockResolvedValue(5) };

describe('teacher review product rules', () => {
  it.each([0, 6])('rejects rating %s before reading a booking', async (rating) => {
    const db = { booking: { findUnique: jest.fn() } };
    await expect(new ReviewsService(db as never, settings as never).create('student-1', 'booking-1', rating, 'خوب')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'REVIEW_RATING_INVALID' }),
    });
    expect(db.booking.findUnique).not.toHaveBeenCalled();
  });

  it('allows an eligible student to create a pending review for their completed booking', async () => {
    const created = { id: 'review-1', teacherId: 'teacher-1', studentId: 'student-1', rating: 5 };
    const tx = {
      review: { create: jest.fn().mockResolvedValue(created) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const db = {
      booking: {
        findUnique: jest.fn().mockResolvedValue({
          teacherId: 'teacher-1', studentId: 'student-1', status: 'COMPLETED',
          attendanceTeacher: true, attendanceStudent: true, review: null,
        }),
      },
      $transaction: jest.fn().mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new ReviewsService(db as never, settings as never);

    await expect(service.create('student-1', 'booking-1', 5, '  تجربه خوب  ')).resolves.toEqual(created);
    expect(tx.review.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        studentId: 'student-1', teacherId: 'teacher-1', bookingId: 'booking-1', rating: 5,
        comment: 'تجربه خوب', moderationStatus: 'PENDING', published: false,
      }),
    }));
  });

  it('allows the owner to update and delete their review', async () => {
    const current = { id: 'review-1', studentId: 'student-1', teacherId: 'teacher-1' };
    const tx = {
      review: {
        update: jest.fn().mockResolvedValue({ ...current, rating: 4 }),
        delete: jest.fn().mockResolvedValue(current),
        aggregate: jest.fn().mockResolvedValue({ _avg: { rating: 4 }, _count: { _all: 1 } }),
      },
      teacher: { update: jest.fn().mockResolvedValue({}) },
    };
    const db = {
      review: { findUnique: jest.fn().mockResolvedValue(current) },
      $transaction: jest.fn().mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new ReviewsService(db as never, settings as never);

    await expect(service.update('student-1', 'review-1', 4, '  بهتر شد  ')).resolves.toMatchObject({ rating: 4 });
    await expect(service.remove('student-1', 'review-1')).resolves.toEqual({ deleted: true });
    expect(tx.review.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ comment: 'بهتر شد' }) }));
    expect(tx.review.delete).toHaveBeenCalledWith({ where: { id: 'review-1' } });
  });

  it('hides another student’s review behind the same not-found response for update and delete', async () => {
    const db = { review: { findUnique: jest.fn().mockResolvedValue({ id: 'review-1', studentId: 'owner-1' }) } };
    const service = new ReviewsService(db as never, settings as never);
    await expect(service.update('student-2', 'review-1', 4, 'نظر جدید')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'REVIEW_NOT_FOUND' }),
    });
    await expect(service.remove('student-2', 'review-1')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'REVIEW_NOT_FOUND' }),
    });
  });

  it('refreshes the public aggregate from approved reviews after an owned mutation', async () => {
    const current = { id: 'review-1', studentId: 'student-1', teacherId: 'teacher-1' };
    const tx = {
      review: {
        update: jest.fn().mockResolvedValue({ ...current, rating: 5 }),
        aggregate: jest.fn().mockResolvedValue({ _avg: { rating: 4.25 }, _count: { _all: 8 } }),
      },
      teacher: { update: jest.fn().mockResolvedValue({}) },
    };
    const db = {
      review: { findUnique: jest.fn().mockResolvedValue(current) },
      $transaction: jest.fn().mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    await new ReviewsService(db as never, settings as never).update('student-1', 'review-1', 5, 'عالی بود');
    expect(tx.teacher.update).toHaveBeenCalledWith({
      where: { id: 'teacher-1' },
      data: { rating: 4.3, reviewsCount: 8 },
    });
  });
});
