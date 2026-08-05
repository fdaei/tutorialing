import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { RateLimitGuard } from './rate-limit.guard';
import { RATE_LIMIT_KEY } from '../decorators/rate-limit.decorator';

type Consume = jest.Mock<Promise<{ count: number; retryAfter: number }>, [string, number]>;

function build(metadata: unknown, consume: Consume, ip = '203.0.113.7') {
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(metadata) } as never;
  const setHeader = jest.fn();
  const context = {
    getHandler: () => null,
    getClass: () => null,
    switchToHttp: () => ({
      getRequest: () => ({ ip, method: 'POST', path: '/auth/otp/request', socket: {} }),
      getResponse: () => ({ setHeader }),
    }),
  } as never;
  return { guard: new RateLimitGuard(reflector, { consume } as never), context, setHeader };
}

const limit = { limit: 3, windowSeconds: 600, bucket: 'auth:otp-send' };

describe('RateLimitGuard', () => {
  it('lets routes without @RateLimit through without touching Redis', async () => {
    const consume: Consume = jest.fn();
    const { guard, context } = build(undefined, consume);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(consume).not.toHaveBeenCalled();
  });

  it('counts a hit against a per-IP key derived from the shared bucket', async () => {
    const consume: Consume = jest.fn().mockResolvedValue({ count: 1, retryAfter: 600 });
    const { guard, context } = build(limit, consume);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(consume).toHaveBeenCalledWith('ratelimit:auth:otp-send:203.0.113.7', 600);
  });

  it('allows exactly the configured limit and rejects the next request', async () => {
    const consume: Consume = jest.fn().mockResolvedValue({ count: 3, retryAfter: 42 });
    const atLimit = build(limit, consume);
    await expect(atLimit.guard.canActivate(atLimit.context)).resolves.toBe(true);

    const overConsume: Consume = jest.fn().mockResolvedValue({ count: 4, retryAfter: 42 });
    const over = build(limit, overConsume);
    await expect(over.guard.canActivate(over.context)).rejects.toMatchObject({ response: { code: 'RATE_LIMITED' } });
    expect(over.setHeader).toHaveBeenCalledWith('Retry-After', '42');
  });

  it('sets RateLimit-* headers on both allowed and rejected responses (RATE-007)', async () => {
    const consume: Consume = jest.fn().mockResolvedValue({ count: 2, retryAfter: 42 });
    const allowed = build(limit, consume);
    await allowed.guard.canActivate(allowed.context);
    expect(allowed.setHeader).toHaveBeenCalledWith('RateLimit-Limit', '3');
    expect(allowed.setHeader).toHaveBeenCalledWith('RateLimit-Remaining', '1');
    expect(allowed.setHeader).toHaveBeenCalledWith('RateLimit-Reset', '42');

    const overConsume: Consume = jest.fn().mockResolvedValue({ count: 5, retryAfter: 42 });
    const over = build(limit, overConsume);
    await expect(over.guard.canActivate(over.context)).rejects.toBeDefined();
    expect(over.setHeader).toHaveBeenCalledWith('RateLimit-Remaining', '0');
  });

  it('separates counters per client IP', async () => {
    const consume: Consume = jest.fn().mockResolvedValue({ count: 1, retryAfter: 600 });
    const other = build(limit, consume, '198.51.100.4');
    await other.guard.canActivate(other.context);
    expect(consume).toHaveBeenCalledWith('ratelimit:auth:otp-send:198.51.100.4', 600);
  });

  it('fails closed when Redis is unreachable', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const consume: Consume = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const { guard, context } = build(limit, consume);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
