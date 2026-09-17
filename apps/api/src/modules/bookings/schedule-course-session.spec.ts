import { BookingsService } from './bookings.service';

const TEACHER_USER = 'teacher-user-1';
const TEACHER_ID = 'teacher-1';
const STUDENT = 'student-1';
const COURSE_ID = 'course-1';
const PACKAGE_ID = 'package-1';
const HOUR_MS = 3_600_000;

function harness(options: {
  creditEntries?: { type: string; _sum: { amount: number | null } }[];
  enrollment?: { id: string } | null;
  bookingCounts?: number[];
} = {}) {
  const lock = { release: jest.fn() };
  const redis = { lock: jest.fn().mockResolvedValue(lock) };
  const course = {
    id: COURSE_ID,
    format: 'LIVE_ONLINE',
    packageId: PACKAGE_ID,
    teacherId: TEACHER_ID,
    teacher: { id: TEACHER_ID, userId: TEACHER_USER },
  };
  const bookingCount = jest.fn();
  (options.bookingCounts ?? [0, 0]).forEach((n) => bookingCount.mockResolvedValueOnce(n));
  const tx = {
    enrollment: {
      findFirst: jest.fn().mockResolvedValue(options.enrollment === undefined ? { id: 'enrollment-1' } : options.enrollment),
    },
    creditEntry: {
      groupBy: jest.fn().mockResolvedValue(options.creditEntries ?? [{ type: 'PURCHASE', _sum: { amount: 15 } }]),
      create: jest.fn().mockResolvedValue({}),
    },
    booking: {
      count: bookingCount,
      create: jest.fn().mockResolvedValue({ id: 'booking-new', startsAt: new Date() }),
    },
  };
  const db = {
    course: { findUnique: jest.fn().mockResolvedValue(course) },
    $transaction: jest.fn().mockImplementation((fn: (t: unknown) => unknown) => fn(tx)),
  };
  const queue = { scheduleBooking: jest.fn() };
  const outbox = { enqueue: jest.fn().mockResolvedValue({}) };
  const svc = new BookingsService(
    db as never,
    {} as never,
    redis as never,
    queue as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    outbox as never,
  );
  return { svc, db, tx, redis, queue };
}

const dto = (over: Record<string, unknown> = {}) => ({
  studentId: STUDENT,
  courseId: COURSE_ID,
  startsAt: new Date(Date.now() + 24 * HOUR_MS).toISOString(),
  endsAt: new Date(Date.now() + 25 * HOUR_MS).toISOString(),
  timezone: 'Asia/Tehran',
  ...over,
});

describe('scheduleCourseSession', () => {
  it('creates a CONFIRMED booking and consumes one credit', async () => {
    const h = harness();
    const booking = await h.svc.scheduleCourseSession(TEACHER_USER, ['INSTRUCTOR'], dto());
    expect(booking).toMatchObject({ id: 'booking-new' });
    expect(h.tx.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          studentId: STUDENT,
          teacherId: TEACHER_ID,
          type: 'course_session',
          status: 'CONFIRMED',
          price: 0,
        }),
      }),
    );
    expect(h.tx.creditEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'CONSUME', amount: 1 }) }),
    );
    expect(h.queue.scheduleBooking).toHaveBeenCalledWith('booking-new', expect.any(Date));
  });

  it('rejects a non-owning teacher', async () => {
    const h = harness();
    await expect(h.svc.scheduleCourseSession('someone-else', ['INSTRUCTOR'], dto())).rejects.toMatchObject({
      response: { code: 'BOOKING_OWNERSHIP_REQUIRED' },
    });
  });

  it('allows an admin regardless of ownership', async () => {
    const h = harness();
    await expect(h.svc.scheduleCourseSession('admin-1', ['ADMIN'], dto())).resolves.toMatchObject({ id: 'booking-new' });
  });

  it('rejects when the student has no active enrollment for the course package', async () => {
    const h = harness({ enrollment: null });
    await expect(h.svc.scheduleCourseSession(TEACHER_USER, ['INSTRUCTOR'], dto())).rejects.toMatchObject({
      response: { code: 'ENROLLMENT_NOT_FOUND' },
    });
  });

  it('rejects once all purchased credits are consumed', async () => {
    const h = harness({
      creditEntries: [
        { type: 'PURCHASE', _sum: { amount: 15 } },
        { type: 'CONSUME', _sum: { amount: 15 } },
      ],
    });
    await expect(h.svc.scheduleCourseSession(TEACHER_USER, ['INSTRUCTOR'], dto())).rejects.toMatchObject({
      response: { code: 'NO_CREDITS_REMAINING' },
    });
  });

  it('rejects a teacher double-booking', async () => {
    const h = harness({ bookingCounts: [1] });
    await expect(h.svc.scheduleCourseSession(TEACHER_USER, ['INSTRUCTOR'], dto())).rejects.toMatchObject({
      response: { code: 'TEACHER_BOOKING_OVERLAP' },
    });
  });

  it('rejects a student double-booking', async () => {
    const h = harness({ bookingCounts: [0, 1] });
    await expect(h.svc.scheduleCourseSession(TEACHER_USER, ['INSTRUCTOR'], dto())).rejects.toMatchObject({
      response: { code: 'STUDENT_BOOKING_OVERLAP' },
    });
  });
});
