import { reminderToken } from './queue.service';

describe('reminderToken', () => {
  it('renders the lesson time in the booking timezone, not UTC', () => {
    // 06:30 UTC is 10:00 in Tehran (+03:30). Sending the UTC instant told a
    // Persian student the wrong hour for their own lesson.
    expect(reminderToken(new Date('2026-08-01T06:30:00.000Z'), 'Asia/Tehran')).toEqual({
      date: '2026-08-01',
      time: '10-00',
    });
  });

  it('produces only digits and hyphens so Kavenegar accepts the token', () => {
    // An ISO string contains `:` and `.`, which the lookup endpoint rejects —
    // the reminder SMS never sent.
    const { date, time } = reminderToken(new Date('2026-08-01T06:30:00.000Z'), 'Asia/Tehran');
    expect(date).toMatch(/^[\d-]+$/);
    expect(time).toMatch(/^[\d-]+$/);
  });

  it('rolls the local date over when the zone pushes past midnight', () => {
    // 21:00 UTC is 00:30 the next day in Tehran.
    expect(reminderToken(new Date('2026-08-01T21:00:00.000Z'), 'Asia/Tehran')).toEqual({
      date: '2026-08-02',
      time: '00-30',
    });
  });

  it('honours a non-Iranian timezone for a student abroad', () => {
    expect(reminderToken(new Date('2026-08-01T06:30:00.000Z'), 'Europe/Berlin')).toEqual({
      date: '2026-08-01',
      time: '08-30',
    });
  });

  it('falls back to Tehran when the stored timezone is malformed', () => {
    // A bad zone must not stop the reminder going out entirely.
    expect(reminderToken(new Date('2026-08-01T06:30:00.000Z'), 'Not/AZone')).toEqual({
      date: '2026-08-01',
      time: '10-00',
    });
  });

  it('pads single-digit hours so the token width is stable', () => {
    const { time } = reminderToken(new Date('2026-08-01T02:05:00.000Z'), 'Asia/Tehran');
    expect(time).toBe('05-35');
  });
});
