import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'lingospeak:rate-limit';

export interface RateLimitOptions {
  /** Maximum requests one client IP may make inside the window. */
  limit: number;
  /** Length of the fixed window, in seconds. */
  windowSeconds: number;
  /**
   * Shared bucket name. Routes given the same name share one counter — used so
   * `otp/request` and `otp/resend` cannot be alternated to double the budget.
   * Defaults to the route's own method + path.
   */
  bucket?: string;
}

/**
 * Rate limits a route per client IP. Opt-in: `RateLimitGuard` lets any route
 * without this metadata through untouched.
 */
export const RateLimit = (options: RateLimitOptions) => SetMetadata(RATE_LIMIT_KEY, options);
