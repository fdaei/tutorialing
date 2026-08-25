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

/**
 * Shared budgets for route classes outside auth (RATE-001): before this,
 * `@RateLimit` was only ever applied to auth.controller.ts, so payments,
 * file uploads, search, and admin bulk-write routes had no request-rate
 * ceiling at all. No `bucket` is set on any of these, so each annotated
 * route still gets its own independent counter (see `RateLimitGuard`'s
 * `options.bucket ?? \`${method}:${path}\`` default) rather than sharing one
 * budget across a whole tier.
 */
export const RATE_LIMIT_TIERS = {
  paymentInit: { limit: 20, windowSeconds: 600 },
  paymentCallback: { limit: 30, windowSeconds: 600 },
  moneyAdjacent: { limit: 30, windowSeconds: 600 },
  fileUpload: { limit: 30, windowSeconds: 600 },
  search: { limit: 60, windowSeconds: 600 },
  publicRead: { limit: 120, windowSeconds: 60 },
  adminWrite: { limit: 120, windowSeconds: 600 },
  examSubmission: { limit: 30, windowSeconds: 600 },
  // Higher budget than examSubmission: the answers endpoint is hit repeatedly
  // by autosave while a test is in progress, not just once per attempt.
  examAutosave: { limit: 120, windowSeconds: 600 },
} as const satisfies Record<string, RateLimitOptions>;
