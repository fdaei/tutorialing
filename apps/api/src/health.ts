import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from './common';
import { PrismaService } from './prisma.service';
import { RedisService } from './common';

type Check = 'connected' | 'unavailable';

/**
 * Upper bound on a single dependency check.
 *
 * `RedisService` builds its client with `maxRetriesPerRequest: null`, which is
 * right for the booking lock — a command waits for a reconnect rather than
 * failing spuriously — but it means a PING issued while Redis is down never
 * settles. Unbounded, this probe hung instead of reporting 503, which is worse
 * than being wrong: the load balancer times the request out and no alert fires.
 */
const CHECK_TIMEOUT_MS = 2_000;

function withTimeout<T>(work: Promise<T>, onTimeout: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(onTimeout), CHECK_TIMEOUT_MS);
    work.then(
      (value) => { clearTimeout(timer); resolve(value); },
      () => { clearTimeout(timer); resolve(onTimeout); },
    );
  });
}

/**
 * Liveness/readiness probe.
 *
 * Redis is checked as well as Postgres because it is a hard dependency of the
 * two paths that must not fail silently: the booking flow takes a distributed
 * lock through it, and the rate limiter fails closed with a 503 when it is
 * unreachable. Reporting only on Postgres meant this returned `ok` while every
 * booking attempt on the site was failing, so an uptime monitor saw nothing.
 *
 * A failed dependency returns 503 rather than 200 with a degraded body, so a
 * plain "is it 2xx" check — which is all this deployment has — actually alerts.
 */
@Controller('health')
export class HealthController {
  constructor(private db: PrismaService, private redis: RedisService) {}

  @Public()
  @Get()
  async health() {
    const [database, cache] = await Promise.all([this.checkDatabase(), this.checkRedis()]);
    const body = {
      status: database === 'connected' && cache === 'connected' ? 'ok' : 'degraded',
      service: 'lingospeak-api',
      database,
      cache,
      time: new Date().toISOString(),
    };
    if (body.status !== 'ok') throw new ServiceUnavailableException(body);
    return body;
  }

  private checkDatabase(): Promise<Check> {
    return withTimeout(this.db.$queryRaw`SELECT 1`.then((): Check => 'connected'), 'unavailable');
  }

  private checkRedis(): Promise<Check> {
    return withTimeout(
      this.redis.client.ping().then((reply): Check => (reply === 'PONG' ? 'connected' : 'unavailable')),
      'unavailable',
    );
  }
}
