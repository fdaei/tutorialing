import { applyDecorators } from '@nestjs/common';
import { Public, RateLimit, type RateLimitOptions } from '../core/decorators';

/**
 * `@Public()` + `@RateLimit()` — every unauthenticated, rate-limited route
 * needs both, so pair them in one decorator instead of repeating the combo.
 */
export const PublicRateLimit = (options: RateLimitOptions) => applyDecorators(Public(), RateLimit(options));
