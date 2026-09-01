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
    await expect(
      new CoursesService(db as never).create('student-1', 'course-1', rating, 'نظر معتبر درباره دوره'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'REVIEW_RATING_INVALID' }),
    });
    expect(db.courseEnrollment.findUnique).not.toHaveBeenCalled();
  });

  it('rejects a whitespace-only comment after normalization', async () => {
    await expect(
      new CoursesService({} as never).create('student-1', 'course-1', 5, '             '),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'REVIEW_COMMENT_INVALID' }),
    });
  });

  it('allows an enrolled student to create a review and refreshes the aggregate', async () => {
    const created = {
      id: 'review-1',
      userId: 'student-1',
      courseId: 'course-1',
      rating: 5,
      comment: 'دوره بسیار کاربردی بود',
    };
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
      data: expect.objectContaining({
        userId: 'student-1',
        courseId: 'course-1',
        rating: 5,
        comment: 'دوره بسیار کاربردی بود',
      }),
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

    await expect(service.update('student-1', 'review-1', 4, '  نظر به‌روزشده دوره  ')).resolves.toMatchObject({
      rating: 4,
    });
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

describe('CoursesService learning progress', () => {
  it('refuses player access without an enrollment', async () => {
    const db = { courseEnrollment: { findFirst: jest.fn().mockResolvedValue(null) } };
    await expect(new CoursesService(db as never).player('student-1', 'course-1')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'COURSE_ENROLLMENT_REQUIRED' }),
    });
  });

  it('scopes progress to an enrolled course and completes it after its final lesson', async () => {
    const tx = {
      courseLessonProgress: {
        upsert: jest.fn().mockResolvedValue({ id: 'progress-1', lessonId: 'lesson-2', completedAt: new Date() }),
        count: jest.fn().mockResolvedValue(2),
      },
      courseLesson: { count: jest.fn().mockResolvedValue(2) },
      courseEnrollment: { update: jest.fn().mockResolvedValue({}) },
    };
    const db = {
      courseEnrollment: { findFirst: jest.fn().mockResolvedValue({ id: 'enrollment-1', courseId: 'course-1' }) },
      courseLesson: { findFirst: jest.fn().mockResolvedValue({ id: 'lesson-2', durationSeconds: 300 }) },
      $transaction: jest.fn().mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const result = await new CoursesService(db as never).progress('student-1', 'course-1', 'lesson-2', {
      completed: true,
      positionSeconds: 999,
    });
    expect(result).toMatchObject({ completedLessons: 2, totalLessons: 2, progressPercent: 100, courseCompleted: true });
    expect(tx.courseLessonProgress.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ positionSeconds: 300, completedAt: expect.any(Date) }),
      }),
    );
    expect(tx.courseEnrollment.update).toHaveBeenCalledWith({
      where: { id: 'enrollment-1' },
      data: { lastLessonId: 'lesson-2', completedAt: expect.any(Date) },
    });
  });

  it('does not accept a lesson from another course', async () => {
    const db = {
      courseEnrollment: { findFirst: jest.fn().mockResolvedValue({ id: 'enrollment-1', courseId: 'course-1' }) },
      courseLesson: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    await expect(
      new CoursesService(db as never).progress('student-1', 'course-1', 'foreign-lesson', { completed: true }),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'COURSE_LESSON_NOT_FOUND' }) });
  });

  it('does not reset a saved media position when only selecting a lesson', async () => {
    const tx = {
      courseLessonProgress: {
        upsert: jest.fn().mockResolvedValue({ id: 'progress-1', lessonId: 'lesson-1', positionSeconds: 92 }),
        count: jest.fn().mockResolvedValue(0),
      },
      courseLesson: { count: jest.fn().mockResolvedValue(2) },
      courseEnrollment: { update: jest.fn().mockResolvedValue({}) },
    };
    const db = {
      courseEnrollment: { findFirst: jest.fn().mockResolvedValue({ id: 'enrollment-1', courseId: 'course-1' }) },
      courseLesson: { findFirst: jest.fn().mockResolvedValue({ id: 'lesson-1', durationSeconds: 300 }) },
      $transaction: jest.fn().mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx)),
    };

    await new CoursesService(db as never).progress('student-1', 'course-1', 'lesson-1', {});

    expect(tx.courseLessonProgress.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ positionSeconds: 0 }),
        update: expect.not.objectContaining({ positionSeconds: expect.anything() }),
      }),
    );
  });
});

describe('CoursesService curriculum ownership', () => {
  it('allows a teacher to manage only a course assigned to their teacher profile', async () => {
    const db = {
      course: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'course-1', teacherId: 'teacher-1', teacher: { userId: 'teacher-user' } }),
      },
      courseChapter: { create: jest.fn().mockResolvedValue({ id: 'chapter-1' }) },
    };
    const service = new CoursesService(db as never);
    await expect(
      service.createChapter(
        { id: 'teacher-user', roles: ['INSTRUCTOR'], permissions: [], sessionId: 'session-1' },
        'course-1',
        { titleFa: 'فصل نخست', titleEn: 'First chapter', order: 1 },
      ),
    ).resolves.toEqual({ id: 'chapter-1' });
    expect(db.courseChapter.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ courseId: 'course-1', published: false }),
    });
  });

  it('rejects a teacher who does not own the course', async () => {
    const db = {
      course: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'course-1', teacherId: 'teacher-1', teacher: { userId: 'owner-user' } }),
      },
      courseChapter: { create: jest.fn() },
    };
    await expect(
      new CoursesService(db as never).createChapter(
        { id: 'other-user', roles: ['INSTRUCTOR'], permissions: [], sessionId: 'session-1' },
        'course-1',
        { titleFa: 'فصل نخست', titleEn: 'First chapter', order: 1 },
      ),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'COURSE_OWNERSHIP_REQUIRED' }) });
    expect(db.courseChapter.create).not.toHaveBeenCalled();
  });
});
