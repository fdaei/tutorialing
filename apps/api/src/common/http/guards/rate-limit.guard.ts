import { CanActivate, ExecutionContext, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { RATE_LIMIT_KEY, type RateLimitOptions } from '../decorators/rate-limit.decorator';
import { tooManyRequests } from '../../errors/domain.exception';
import { RedisService } from '../../../infrastructure/redis/redis.service';

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly log = new Logger(RateLimitGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly redis: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<RateLimitOptions | undefined>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!options) return true;

    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const bucket = options.bucket ?? `${request.method}:${request.path}`;
    const key = `ratelimit:${bucket}:${clientIp(request)}`;

    let count: number;
    let retryAfter: number;
    try {
      ({ count, retryAfter } = await this.redis.consume(key, options.windowSeconds));
    } catch (error) {

      this.log.error({ err: error, bucket, requestId: request.headers?.['x-request-id'] }, 'Rate limiter unavailable');
      throw new ServiceUnavailableException('Rate limiter unavailable');
    }

    const response = http.getResponse<Response>();
    response.setHeader('RateLimit-Limit', String(options.limit));
    response.setHeader('RateLimit-Remaining', String(Math.max(0, options.limit - count)));
    response.setHeader('RateLimit-Reset', String(retryAfter));

    if (count > options.limit) {
      response.setHeader('Retry-After', String(retryAfter));
      throw tooManyRequests('RATE_LIMITED', retryAfter);
    }
    return true;
  }
}

function clientIp(request: Request) {
  return request.ip ?? request.socket.remoteAddress ?? 'unknown';
}
