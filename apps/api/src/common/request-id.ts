import { randomUUID } from 'crypto';

const SAFE_REQUEST_ID = /^[A-Za-z0-9_-]{1,100}$/;

export function requestId(value: unknown) {
  return typeof value === 'string' && SAFE_REQUEST_ID.test(value) ? value : randomUUID();
}
