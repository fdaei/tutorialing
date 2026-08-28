import { CoursesService } from './courses.service';

describe('CoursesService reviews', () => {
  it('reports enrollment-backed eligibility and the current review', async () => {
    const review = { id: 'review-1', userId: 'student-1', courseId: 'course-1', rating: 5 };
    const db = {
      courseEnrollment: { findUnique: jest.fn().mockResolvedValue({ id: 'enrollment-1' }) },
      courseReview: { findUnique: jest.fn().mockResolvedValue(review) },
      $transaction: jest.fn().mockImplementation((queries: Array<Promise<unknown>>) => Promise.all(queries)),
    };
    const service = new CoursesService(db as never);

    await expect(service.eligibility('student-1', 'course-1')).resolves.toEqual({ eligible: true, review });
    expect(db.courseEnrollment.findUnique).toHaveBeenCalledWith({
      where: { userId_courseId: { userId: 'student-1', courseId: 'course-1' } },
      select: { id: true },
    });
  });

  it('reports an unenrolled student as ineligible', async () => {
    const db = {
      courseEnrollment: { findUnique: jest.fn().mockResolvedValue(null) },
      courseReview: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn().mockImplementation((queries: Array<Promise<unknown>>) => Promise.all(queries)),
    };
    await expect(new CoursesService(db as never).eligibility('student-2', 'course-1')).resolves.toEqual({
      eligible: false,
      review: null,
    });
  });

  it.each([0, 6])('rejects rating %s before writing', async (rating) => {
    const db = { courseEnrollment: { findUnique: jest.fn() } };
    await expect(new CoursesService(db as never).create('student-1', 'course-1', rating, 'نظر معتبر درباره دوره')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'REVIEW_RATING_INVALID' }),
    });
    expect(db.courseEnrollment.findUnique).not.toHaveBeenCalled();
  });

  it('rejects a whitespace-only comment after normalization', async () => {
    await expect(new CoursesService({} as never).create('student-1', 'course-1', 5, '             ')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'REVIEW_COMMENT_INVALID' }),
    });
  });

  it('allows an enrolled student to create a review and refreshes the aggregate', async () => {
    const created = { id: 'review-1', userId: 'student-1', courseId: 'course-1', rating: 5, comment: 'دوره بسیار کاربردی بود' };
    const tx = {
      courseReview: {
        create: jest.fn().mockResolvedValue(created),
        aggregate: jest.fn().mockResolvedValue({ _avg: { rating: 4.25 }, _count: { _all: 8 } }),
      },
      course: { update: jest.fn().mockResolvedValue({}) },
    };
    const db = {
      courseEnrollment: { findUnique: jest.fn().mockResolvedValue({ id: 'enrollment-1' }) },
      courseReview: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn().mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new CoursesService(db as never);

    await expect(service.create('student-1', 'course-1', 5, '  دوره بسیار کاربردی بود  ')).resolves.toEqual(created);
    expect(tx.courseReview.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'student-1', courseId: 'course-1', rating: 5, comment: 'دوره بسیار کاربردی بود' }),
    });
    expect(tx.course.update).toHaveBeenCalledWith({
      where: { id: 'course-1' },
      data: { rating: 4.3, reviewsCount: 8 },
    });
  });

  it('allows the owner to update and delete a review', async () => {
    const current = { id: 'review-1', userId: 'student-1', courseId: 'course-1', rating: 3 };
    const tx = {
      courseReview: {
        update: jest.fn().mockResolvedValue({ ...current, rating: 4 }),
        delete: jest.fn().mockResolvedValue(current),
        aggregate: jest.fn().mockResolvedValue({ _avg: { rating: 4 }, _count: { _all: 1 } }),
      },
      course: { update: jest.fn().mockResolvedValue({}) },
    };
    const db = {
      courseReview: { findUnique: jest.fn().mockResolvedValue(current) },
      $transaction: jest.fn().mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new CoursesService(db as never);

    await expect(service.update('student-1', 'review-1', 4, '  نظر به‌روزشده دوره  ')).resolves.toMatchObject({ rating: 4 });
    await expect(service.remove('student-1', 'review-1')).resolves.toEqual({ deleted: true });
    expect(tx.courseReview.delete).toHaveBeenCalledWith({ where: { id: 'review-1' } });
  });

  it('does not allow another student to update or delete a review', async () => {
    const db = { courseReview: { findUnique: jest.fn().mockResolvedValue({ id: 'review-1', userId: 'owner-1' }) } };
    const service = new CoursesService(db as never);
    await expect(service.update('student-2', 'review-1', 4, 'نظر معتبر درباره دوره')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'COURSE_REVIEW_NOT_FOUND' }),
    });
    await expect(service.remove('student-2', 'review-1')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'COURSE_REVIEW_NOT_FOUND' }),
    });
  });
});
