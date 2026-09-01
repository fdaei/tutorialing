import { NextRequest, NextResponse } from 'next/server';
import { webConfig } from './config';

// A strict, nonce-based script-src is the actual precondition that lets an
// injected <script> read sessionStorage (e.g. the access token) and exfiltrate
// it. 'strict-dynamic' lets Next.js's own nonced scripts load their chunks
// without needing per-chunk allowlisting. Direct presigned uploads are limited
// to the explicitly configured object-storage origin.
// The dev server ships webpack modules and HMR through eval(), so without a
// dev-only 'unsafe-eval' no client JS runs at all and every page renders blank.
// Production bundles never eval, so the deployed CSP stays strict.
const devEval = webConfig.nodeEnv === 'development' ? " 'unsafe-eval'" : '';
function origin(value: string) {
  try {
    return value ? new URL(value).origin : '';
  } catch {
    return '';
  }
}

const apiOrigin = origin(webConfig.apiUrl);
const externalOrigin = origin(webConfig.s3Origin);

function cspHeader(nonce: string) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${devEval}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob:${externalOrigin ? ` ${externalOrigin}` : ''}`,
    "font-src 'self' data:",
    `media-src 'self' blob:${externalOrigin ? ` ${externalOrigin}` : ''}`,
    `connect-src 'self'${apiOrigin ? ` ${apiOrigin}` : ''}${externalOrigin ? ` ${externalOrigin}` : ''}`,
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'self'",
    "form-action 'self'",
  ].join('; ');
}

export function middleware(request: NextRequest) {
  const english = request.nextUrl.pathname === '/en' || request.nextUrl.pathname.startsWith('/en/');
  const locale = english ? 'en' : 'fa';
  const nonce = btoa(crypto.randomUUID());
  const csp = cspHeader(nonce);
  const headers = new Headers(request.headers);
  headers.set('x-lingospeak-locale', locale);
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', csp);
  const url = request.nextUrl.clone();
  if (english) {
    url.pathname = request.nextUrl.pathname.replace(/^\/en(?=\/|$)/, '') || '/';
  }
  const response = english
    ? NextResponse.rewrite(url, { request: { headers } })
    : NextResponse.next({ request: { headers } });
  response.cookies.set('lingospeak_locale', locale, {
    path: '/',
    maxAge: webConfig.localeCookieMaxAgeSeconds,
    sameSite: 'lax',
  });
  response.headers.set('Content-Language', locale);
  response.headers.set('Content-Security-Policy', csp);
  return response;
}
export const config = { matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'] };
