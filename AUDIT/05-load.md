# Phase 5 — Load, Stress & Correctness-Under-Concurrency

Executed locally against `apps/api` running in dev mode (`nest start:dev`, not a production
build) on an isolated Postgres/Redis/MinIO stack (`docker compose -p lingospeak-audit`, host
ports remapped to 15432/16379/19000-19001 to avoid an unrelated stack already running on this
machine's default ports — see `AUDIT/00-map.md`/`state.json` for that note). `ZARINPAL_SANDBOX=false`
and no `ZARINPAL_MERCHANT_ID` so `gateway.service.ts` uses its documented dev-fallback path
(`dev_<uuid>` authorities, auto-verified) — no traffic left the machine. Never run against a
deployed environment.

k6 is not installed in this environment and could not be installed without adding a system
package outside the repo's own tooling; per the prompt's own fallback clause ("k6 (or autocannon
fallback)") this suite uses `autocannon` (via `npx`) for raw throughput/latency, and plain Node
scripts (`load/*.mjs`) for the scripted, assertion-bearing scenarios (payment flow, rate limits)
that autocannon's fixed-request-per-connection model can't express.

## Files

| File | Purpose |
|---|---|
| `load/smoke.mjs` | 1-VU golden path: login → browse → book → pay → dev-gateway verify → assert `CONFIRMED` |
| `load/payment-flow.mjs` | Concurrency correctness: duplicate `gatewayRedirect` (FIN-002), duplicate-callback storm (FIN-009), concurrent same-slot booking (FIN-006) |
| `load/ratelimit.mjs` | Hammers a `@RateLimit`-protected route (OTP request) and a confirmed-unprotected one (`GET /teachers`, RATE-001) |
| `load/load.sh` | autocannon, 20 connections / 30s, expected-peak baseline on two public read routes |
| `load/stress.sh` | autocannon ramp: 10 → 50 → 100 → 200 connections / 15s each, to find the knee |
| `load/spike.sh` | autocannon: 5-connection baseline then a sudden 100-connection (20x) burst |
| `load/soak.sh` | autocannon sustained run; defaults to the spec's 2h via `SOAK_SECONDS`, see caveat below |

## Smoke — PASS

`node load/smoke.mjs`: login (OTP dev-code) → `GET /teachers/sara-dadkhah` → `GET
/availability/:id/slots` → `POST /bookings` (trial) → `POST /payments` → `POST
/payments/:id/gateway` → `GET /payments/callback` → `GET /bookings/me` confirms `status:CONFIRMED`.
Full path works end to end against a fresh seeded DB.

## load.sh — expected-peak baseline (20 connections, 30s)

| Route | Req/s (avg) | Latency p50 | Latency p99 | Total |
|---|---|---|---|---|
| `GET /teachers` (DB query + language-link join) | 369 | 52 ms | 81 ms | 11k req / 30s |
| `GET /languages` (lighter query) | 1,421 | 13 ms | 26 ms | 43k req / 30s |

## stress.sh — ramp to find the knee (`GET /teachers`)

| Connections | Req/s (avg) | Latency p50 | Latency p99 | Latency max |
|---|---|---|---|---|
| 10 | 367 | 26 ms | 44 ms | 63 ms |
| 50 | 361 | 134 ms | 187 ms | 296 ms |
| 100 | 363 | 269 ms | 335 ms | 366 ms |
| 200 | 360 | 546 ms | 641 ms | 722 ms |

**Finding LOAD-001**: throughput is flat (~360-370 req/s) across a **20x range of concurrency**
(10 → 200 connections) — this is not "found the breaking point via errors/5xx," it's a hard
serialization ceiling: excess concurrent requests don't get rejected or shed, they queue, and
p50/p99 latency scale roughly linearly with the connection count (26ms → 546ms, ~21x, tracking the
~20x connection increase almost 1:1). Zero request failures/5xx at any level tested. Consistent
with a single Node event-loop process (dev mode, no clustering/`NODE_ENV=production` build, no PM2
cluster mode) with no admission-control layer in front of it — which is exactly what **RATE-001**
already found (nothing rate-limits `GET /teachers`), so under real excess load this route degrades
every caller's latency together rather than shedding the excess. Not itself a code bug to "fix"
via a one-line patch — it's a capacity/architecture observation: (a) numbers here are dev-mode,
re-measure against a production build before sizing real capacity; (b) the queue-don't-shed
behavior is the reason RATE-001 matters beyond abuse-prevention — it's also the availability
backstop for legitimate traffic under load.

## spike.sh — sudden 20x burst (5 → 100 connections)

| Phase | Req/s (avg) | Latency p50 | Latency p99 |
|---|---|---|---|
| Baseline (5 conn) | 339 | 14 ms | 21 ms |
| Spike (100 conn) | 364 | 268 ms | 317 ms |

Same shape as the stress ramp: the server absorbed a sudden 20x jump in concurrent connections
with zero errors, just proportionally higher latency. No crash, no connection resets observed.

## soak.sh — caveat

The spec calls for a 2-hour sustained run to surface memory leaks / connection-pool exhaustion /
socket churn. That was **not** run for its full duration in this session (impractical within an
interactive audit turn) — `load/soak.sh` is written to the real 2h default (override via
`SOAK_SECONDS` for a quick check) and is ready to run standalone; running it and watching
`docker stats` (Postgres/Redis/MinIO containers) plus the API process's RSS over the full 2h is
listed as follow-up work in the report, not something this pass can claim to have verified.

## payment-flow.mjs — concurrency correctness (`node load/payment-flow.mjs`)

Real HTTP concurrency against the live local stack, not code reading. Random phone numbers are
generated per run to sidestep the app's own "one trial per teacher" business rule across repeated
executions.

**FIN-002 (duplicate `gatewayRedirect`) — REPRODUCED under real concurrency.** Two concurrent
`POST /payments/:id/gateway` calls for the same payment returned two distinct `dev_<uuid>`
authorities. Probing `GET /payments/callback` on both afterward: one returned `200` (the authority
that won the last DB write), the other returned `404` (`payment.authority` in the DB no longer
matches it — permanently unlookupable). This is the exact orphaning behavior `AUDIT/02-financial.md`
described from code reading, now confirmed live: a double-click on "Pay" produces a real ZarinPal
session that the platform can silently never reconcile if the *other* one is the one the user
actually completes.

**FIN-009 (idempotency / duplicate-callback storm) — mostly confirmed, one new minor observation.**
10 truly-simultaneous `GET /payments/callback` calls on the *same* valid authority: 9 returned
`200`, 1 returned `409` (Postgres Serializable write-conflict, `errors.ts`'s mapping of Prisma
`P2034`), 0 returned 5xx, and no evidence of double-grant (a single ledger/entitlement transition,
consistent with the unique-idempotency-key design `AUDIT/02-financial.md` verified from code). The
one `409` is a **new, minor finding**: a real ZarinPal retry landing in that exact race window
would see a transient failure rather than a clean idempotent re-verify. Not a money-safety bug —
the row still transitions exactly once — but worth a follow-up (retry the transaction on `P2034`
for this specific handler, the way some other money-paths already do) if ZarinPal's real retry
behavior under contention turns out to matter. Recorded as `LOAD-002` below rather than folded into
FIN-009, since it's a robustness/retry-shape finding, not a correctness one.

**FIN-006 (concurrent same-slot booking) — NOT reproduced, confirms the audit's "correctly
guarded" verdict.** Two different students POSTing `/bookings` for the identical
`teacherId`+`startsAt` simultaneously: exactly 1 of 2 succeeded (`201`), the other was rejected.
Matches `AUDIT/02-financial.md`'s FIN-006 conclusion that the Redis lock + Serializable-isolation
pair genuinely prevents double-booking, now verified under real concurrent HTTP requests rather
than by code reading alone.

## ratelimit.mjs — proves limits trigger as designed (`node load/ratelimit.mjs`)

`POST /auth/otp/request` (protected, `@RateLimit`, limit 10/600s per IP, shared with
`otp/resend`): by the time this script ran, the IP-wide window was already exhausted from the
smoke/payment-flow runs earlier in this session (same IP, same shared bucket) — so all 15 requests
in this burst returned `429` immediately (`sequence: 429×15`), each with a populated `Retry-After:
102` header, zero 5xx. This is itself a valid (if less visually staged) confirmation: the limiter
held the block for the full window across multiple separate script invocations rather than
resetting per-process, and it degrades cleanly (429, not a hang or 500) once tripped. Earlier in
this session's manual smoke-test runs, the same route was independently observed returning `201`
for the first several calls before a `429 OTP_RESEND_TOO_SOON` / window-limit response kicked in —
so both the "allows N then blocks" and "stays blocked for the stated Retry-After duration" halves
of the mechanism were exercised, just not within one single script run.

`GET /teachers` (confirmed unprotected, RATE-001): 50 fully concurrent requests, **0** rate-limited,
all served. Empirically confirms RATE-001 — there is currently no request-rate ceiling at all on
this (or any non-auth) route; it will absorb any burst up to whatever the underlying process can
serve (see LOAD-001's saturation-not-shedding behavior for what happens past that point).

## New findings from this phase

### LOAD-001 — `GET /teachers` throughput plateaus (~360-370 req/s) across a 20x concurrency range; excess load queues instead of shedding (medium, area: perf)
See stress.sh/spike.sh tables above. Dev-mode measurement — re-run against a production build
before using these numbers for capacity planning. The structural point (no admission control, so
concurrency growth becomes latency growth for everyone rather than a controlled subset of requests
being fast-rejected) stands independent of the exact throughput ceiling.

### LOAD-002 — Genuinely simultaneous duplicate ZarinPal callbacks can get a transient `409` instead of an idempotent `200` (low, area: financial/robustness)
Evidence: `load/payment-flow.mjs`'s callback-storm scenario, this run: 9/10 concurrent identical
`GET /payments/callback` calls returned `200`, 1 returned `409` (Postgres `P2034` write conflict
inside `payments.service.ts`'s `$transaction(Serializable)`, mapped by `apps/api/src/common/errors.ts`).
No double-grant occurred (confirmed correct per FIN-009's design), but the `409` caller received an
error rather than the already-successful payment state. Minimal fix direction (not applied — touches
the money-flow transaction, flagging per the same hard rule as the FIN-* items): retry once on
`P2034` inside `callback()`, or catch it and re-read the now-committed row instead of surfacing the
conflict to the caller.

## Exit-criteria check against Phase 0 baseline

- Duplication (`jscpd`) and circular-dependency (`madge`) counts: unchanged (0/0) — this phase made
  no code changes, only added `load/*`.
- `ratelimit.js`/`payment-flow.js` scenarios: **do not yet pass a "no critical findings" bar** —
  they *proved* FIN-002 and RATE-001 are real, which is exactly what they were built to do before
  any fix lands. Re-run both after Phase 6 fixes land for FIN-002/RATE-001 and expect the
  duplicate-authority and unlimited-burst behaviors to disappear.
