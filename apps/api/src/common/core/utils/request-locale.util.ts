import type { Request } from 'express';

export type RequestLocale = 'fa' | 'en';

export function requestLocale(request: Request): RequestLocale {
  return String(request.headers['accept-language'] ?? 'fa').toLowerCase().startsWith('en') ? 'en' : 'fa';
}
