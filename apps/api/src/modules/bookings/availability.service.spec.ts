import { AvailabilityService } from './availability.service';

describe('AvailabilityService blocked periods', () => {
  it('creates and deletes a teacher-owned blocked period', async () => {
    const create = jest.fn(({ data }) => ({ id: 'block-1', ...data }));
    const db = {
      teacher: { findUnique: jest.fn().mockResolvedValue({ id: 'teacher-1' }) },
      blockedPeriod: { findFirst: jest.fn().mockResolvedValue(null), create, deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
    } as any;
    const service = new AvailabilityService(db);
    const start = new Date(Date.now() + 86_400_000).toISOString();
    const end = new Date(Date.now() + 90_000_000).toISOString();
    await service.addBlock('teacher-user', { startsAt: start, endsAt: end, reason: 'Personal' });
    await expect(service.deleteBlock('teacher-user', 'block-1')).resolves.toEqual({ ok: true });
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ teacherId: 'teacher-1', reason: 'Personal', adminCreated: false }) });
  });

  it('removes a blocked interval from public slots', async () => {
    const tomorrow = new Date(Date.now() + 2 * 86_400_000);
    tomorrow.setUTCHours(0, 0, 0, 0);
    const start = new Date(tomorrow); start.setUTCHours(10, 0, 0, 0);
    const end = new Date(tomorrow); end.setUTCHours(11, 0, 0, 0);
    const db = { teacher: { findFirst: jest.fn().mockResolvedValue({
      trialDuration: 30, lessonDuration: 60, breakMinutes: 0,
      availabilityRules: [{ weekday: tomorrow.getUTCDay(), startMinute: 600, endMinute: 660, timezone: 'UTC', breakMinutes: 0 }],
      availabilityOverrides: [], blockedPeriods: [{ startsAt: start, endsAt: end }], bookings: [],
    }) } } as any;
    const service = new AvailabilityService(db);
    const to = new Date(tomorrow.getTime() + 86_400_000 - 1);
    await expect(service.slots('teacher-1', tomorrow, to, 'regular')).resolves.toEqual([]);
  });
});

  it('uses the teacher local date near a UTC day boundary', async () => {
    // 2027-01-03 21:30 UTC is Monday 01:00 in Asia/Tehran.
    const from = new Date('2027-01-03T21:00:00.000Z');
    const to = new Date('2027-01-03T22:30:00.000Z');
    const db = { teacher: { findFirst: jest.fn().mockResolvedValue({
      trialDuration: 30, lessonDuration: 60, breakMinutes: 0,
      availabilityRules: [{ weekday: 1, startMinute: 60, endMinute: 120, timezone: 'Asia/Tehran', breakMinutes: 0 }],
      availabilityOverrides: [], blockedPeriods: [], bookings: [],
    }) } } as any;
    const service = new AvailabilityService(db);

    const slots = await service.slots('teacher-1', from, to, 'regular');

    expect(slots).toHaveLength(1);
    expect(slots[0]).toMatchObject({ date: '2027-01-04', timezone: 'Asia/Tehran' });
    expect(slots[0]?.startsAt).toBe('2027-01-03T21:30:00.000Z');
  });
