const RedisMock = jest.fn();
jest.mock('ioredis', () => ({ __esModule: true, default: RedisMock }));

describe('RedisService client config (RATE-002)', () => {
  afterEach(() => jest.resetModules());

  it('disables the offline command queue so a command issued during an outage rejects instead of hanging', async () => {
    const { RedisService } = await import('./redis.service');
    // eslint-disable-next-line no-new
    new RedisService();
    expect(RedisMock).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ enableOfflineQueue: false }));
  });
});
