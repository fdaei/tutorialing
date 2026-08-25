// ratelimit.js — proves the limiter triggers as designed on a protected route
// (POST /auth/otp/request, see AUDIT/04-ratelimit.md §3) and confirms the
// RATE-001 finding empirically: an unprotected route (GET /teachers) takes an
// unlimited burst with zero 429s because no @RateLimit decorator exists there.
import { api } from './lib/client.mjs';

async function hammerOtpRequest(n) {
  console.log(`\n--- hammering POST /auth/otp/request x${n} (protected route, limit is 10/600s per IP) ---`);
  const results = [];
  for (let i = 0; i < n; i++) {
    const phone = `09${String(100000000 + i).padStart(9, '0')}`;
    // eslint-disable-next-line no-await-in-loop
    const res = await api('/auth/otp/request', { method: 'POST', body: JSON.stringify({ phone }) });
    results.push({ i, status: res.status, retryAfter: res.headers.get('retry-after') });
  }
  const ok = results.filter((r) => r.status < 300).length;
  const limited = results.filter((r) => r.status === 429).length;
  const serverErrors = results.filter((r) => r.status >= 500).length;
  console.log(`  ${ok} succeeded, ${limited} got 429, ${serverErrors} server errors`);
  console.log(`  sequence: ${results.map((r) => r.status).join(',')}`);
  const firstLimited = results.find((r) => r.status === 429);
  if (firstLimited) {
    console.log(
      `  first 429 at request #${firstLimited.i}, Retry-After header: ${firstLimited.retryAfter ?? '(none)'}`,
    );
    if (!firstLimited.retryAfter)
      console.log('  NOTE: no Retry-After header on the 429 — unexpected, check rate-limit.guard.ts');
  } else {
    console.log(
      `  WARNING: never hit 429 across ${n} requests — either the window budget was already fresh and large, or the limiter did not trigger`,
    );
  }
  if (serverErrors > 0)
    console.log(
      `  WARNING: ${serverErrors} requests returned 5xx instead of a clean 429/200 — check fail-mode (RATE-002)`,
    );
  return results;
}

async function burstUnprotectedRoute(n) {
  console.log(`\n--- bursting GET /teachers x${n} concurrently (RATE-001: confirmed no @RateLimit on this route) ---`);
  const start = Date.now();
  const results = await Promise.all(Array.from({ length: n }, () => api('/teachers')));
  const elapsed = Date.now() - start;
  const statuses = results.map((r) => r.status);
  const ok = statuses.filter((s) => s === 200).length;
  const limited = statuses.filter((s) => s === 429).length;
  console.log(`  ${n} concurrent requests in ${elapsed}ms: ${ok} ok, ${limited} rate-limited`);
  if (limited === 0) {
    console.log(
      '  CONFIRMS RATE-001: an unauthenticated, high-volume-capable read route absorbed a full burst with zero throttling.',
    );
  } else {
    console.log(
      '  Unexpected: this route returned 429s — a limiter must have been added since the audit; re-check AUDIT/04-ratelimit.md.',
    );
  }
}

async function main() {
  await hammerOtpRequest(15);
  await burstUnprotectedRoute(50);
  console.log('\nratelimit.js complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
