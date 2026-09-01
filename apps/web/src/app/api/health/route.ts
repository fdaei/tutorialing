import { NextResponse } from 'next/server';

/**
 * Liveness probe for the web container.
 *
 * Deliberately dependency-free: it must answer while the API, database or
 * object storage are down, because Compose uses it to decide whether this
 * container is healthy. A probe that reached the API would make the web
 * container unhealthy for a backend outage and take the whole site offline
 * instead of showing whatever it can render.
 *
 * It lives under `/api` so the middleware matcher in `src/middleware.ts` skips
 * it — no CSP nonce, no locale rewrite, no cookie on a machine request. In
 * production that also means it is unreachable from outside: Caddy routes
 * every `/api/*` path to the NestJS API, so this handler only ever answers
 * requests made inside the container.
 */
export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({ status: 'ok', service: 'lingospeak-web' });
}
