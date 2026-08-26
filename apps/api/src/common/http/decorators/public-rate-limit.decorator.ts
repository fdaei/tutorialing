import { applyDecorators } from '@nestjs/common';
import { Public } from './public.decorator';
import { RateLimit, type RateLimitOptions } from './rate-limit.decorator';

/**
 * `@Public()` + `@RateLimit()` — every unauthenticated, rate-limited route
 * needs both, so pair them in one decorator instead of repeating the combo.
 */
export const PublicRateLimit = (options: RateLimitOptions) => applyDecorators(Public(), RateLimit(options));
