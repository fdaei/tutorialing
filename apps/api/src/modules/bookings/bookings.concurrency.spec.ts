import { BookingsService } from './bookings.service';

describe('BookingsService concurrency protection', () => {
  it('rejects a simultaneous booking when the Redis lock is already held', async () => {
    const redis = { lock: jest.fn().mockResolvedValue(null) } as any;
    const service = new BookingsService({} as any, {} as any, redis, {} as any, {} as any);
    await expect(service.create('student-1', {
      teacherId: 'teacher-1', startsAt: new Date(Date.now() + 86_400_000).toISOString(), type: 'regular', policyAccepted: true, timezone: 'Asia/Tehran',
    })).rejects.toMatchObject({ response: expect.objectContaining({ code: 'SLOT_LOCKED' }) });
  });
});
