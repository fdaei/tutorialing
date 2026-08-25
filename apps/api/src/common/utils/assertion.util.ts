import type { HttpException } from '@nestjs/common';

type ExceptionFactory = HttpException | (() => HttpException);

/**
 * Narrows a value after enforcing a domain invariant.
 *
 * The exception is created lazily so callers do not allocate it on the happy
 * path. Keeping this helper independent from a particular error code also
 * lets each feature retain ownership of its domain language.
 */
export function assertDomain(condition: unknown, exception: ExceptionFactory): asserts condition {
  if (condition) return;
  throw typeof exception === 'function' ? exception() : exception;
}

/**
 * Returns a nullable value after proving it exists. This is useful for lookup
 * results because the returned value keeps its narrowed type.
 */
export function requireValue<T>(value: T, exception: ExceptionFactory): NonNullable<T> {
  assertDomain(value !== null && value !== undefined, exception);
  return value;
}
