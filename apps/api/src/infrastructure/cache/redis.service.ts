import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { config } from '../../config';

// INCR the counter and, only on the first hit of a window, arm its expiry. Doing
// both in one script keeps a crash between the two commands from leaving a
// counter that never expires and permanently locks the caller out.
const CONSUME_SCRIPT =
  "local c=redis.call('INCR',KEYS[1]) if c==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end return {c,redis.call('TTL',KEYS[1])}";

@Injectable()
export class RedisService implements OnModuleDestroy {
  // `enableOfflineQueue:false` so a command issued while disconnected rejects
  // immediately instead of sitting in ioredis's offline queue until
  // reconnection -- without it, `consume()`/`lock()` calls hang for as long as
  // the outage lasts rather than throwing, and RateLimitGuard's fail-closed
  // catch block (which is meant to 503 fast during a Redis outage) never gets
  // the rejection it's waiting for.
  readonly client = new Redis(config().REDIS_URL, { maxRetriesPerRequest: null, enableOfflineQueue: false });

  async lock(key: string, ttl = 10000) {
    const token = `${Date.now()}-${Math.random()}`;
    const ok = await this.client.set(`lock:${key}`, token, 'PX', ttl, 'NX');
    return ok
      ? {
          token,
          release: async () => {
            const script =
              "if redis.call('get',KEYS[1])==ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end";
            await this.client.eval(script, 1, `lock:${key}`, token);
          },
        }
      : null;
  }

  /** Counts one hit against a fixed window and reports the running total plus seconds until it resets. */
  async consume(key: string, windowSeconds: number) {
    const [count, ttl] = (await this.client.eval(CONSUME_SCRIPT, 1, key, String(windowSeconds))) as [number, number];
    return { count, retryAfter: ttl > 0 ? ttl : windowSeconds };
  }

  onModuleDestroy() {
    return this.client.quit();
  }
}
