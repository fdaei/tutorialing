import type { MetadataRoute } from 'next';
import { webConfig } from '@/config';

/**
 * Paths that never render anything a crawler should hold: the panels, the
 * authentication flow, the checkout and gateway callbacks, and the exam runner.
 * Mirrors the private side of `ROUTE_RULES` (lib/panel-access.ts) — when a new
 * panel route is added there, add its prefix here too.
 */
const PRIVATE_PREFIXES = [
  '/admin',
  '/panel',
  '/teacher-panel',
  '/dashboard',
  '/checkout',
  '/payment',
  '/auth',
  '/login',
  '/register',
  '/verify-code',
  '/forgot-password',
  '/reset-password',
  '/placement',
  '/matching',
  '/teacher-apply',
  '/test',
  '/api',
];

/** `/en` is a rewrite of the same routes, so every private prefix has a second spelling. */
const disallow = PRIVATE_PREFIXES.flatMap((prefix) => [`${prefix}/`, `/en${prefix}/`]);

export default function robots(): MetadataRoute.Robots {
  // An unconfigured NEXT_PUBLIC_WEB_URL leaves webUrl on its localhost default,
  // which would also make every sitemap URL point at localhost. Refusing to be
  // indexed is the better failure of the two, and it keeps preview deployments
  // that inherit the default out of the index.
  const configured = !new URL(webConfig.webUrl).hostname.match(/^(localhost|127\.0\.0\.1|\[::1\])$/);
  if (!configured) return { rules: { userAgent: '*', disallow: '/' } };

  return {
    rules: { userAgent: '*', allow: '/', disallow },
    sitemap: new URL('/sitemap.xml', webConfig.webUrl).toString(),
    host: new URL(webConfig.webUrl).origin,
  };
}
