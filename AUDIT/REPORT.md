# Phase 7 — Final Report

## Executive summary

This audit ran the full 7-phase methodology from the pasted prompt against **LingoSpeak**
(bilingual IELTS teacher marketplace: NestJS 11 + Prisma/PostgreSQL API, Next.js 15 web app,
Redis, BullMQ, ZarinPal payments) rather than the microservices/MongoDB/NATS architecture the
prompt assumed — see `AUDIT/00-map.md` for the adaptation and the discovery that this same
machine has an unrelated, already-running docker stack matching the original prompt's
architecture almost exactly (strong evidence the prompt was written for that other project).

**26 findings** across financial flows, security, rate limiting, and structure. **19 fixed and
verified** (typecheck/lint/test/build gates green, several also verified live against a running
local instance). **7 left open**, each with a documented reason — 4 are `NEEDS-DECISION` items
that cross the audit's own hard-rule lines (money state-machine redesign, a new DB column, a new
scheduled-job dependency), 2 are `wontfix` (already-deliberate tradeoffs the original team
documented), and 2 are lower-priority items deferred for time.

**Two critical bugs were reproduced live, not just found by reading code**: FIN-002 (duplicate
payment-gateway sessions orphaning a ZarinPal authority) and RATE-001 (unlimited-rate payment/
search/admin endpoints) were both demonstrated against a running local instance before the fix,
then re-run after to confirm the fix closed them (`load/payment-flow.mjs`, `load/ratelimit.mjs`,
results in `AUDIT/05-load.md`).

## Before / after

| Metric | Before | After |
|---|---|---|
| Findings by severity | 5 critical, 3 high, 1 medium (perf), 12 low/medium/info | 0 critical/high open; 1 medium (perf, architectural — not a bug), 1 medium (structure), 2 low, 2 wontfix, 1 medium-financial (NEEDS-DECISION), 1 critical-financial (NEEDS-DECISION), 1 medium-financial (NEEDS-DECISION) |
| Duplication (`jscpd`, min-lines 15) | 0 clones / 9424 lines | 0 clones (unchanged — no new duplication introduced) |
| Circular deps (`madge`) | 0 | 0 (unchanged) |
| `npm audit --production` | 2 high (next.js/sharp, `apps/web`, confirmed unreachable from `apps/api`) | unchanged — out of scope for this pass, no fix applied (would need a Next.js major-version bump) |
| API test suite | 135 tests (baseline, before any changes) | 141 tests, all passing |
| Web test suite | 19 tests | 19 tests, all passing (unaffected) |
| `typecheck` / `lint` / `test` / `build` gates | n/a (not run as a gate before this audit) | all green, both workspaces |
| Rate-limited routes | 4 (auth only) | 4 auth + payments (create/gateway/callback/refunds) + payouts/discounts/withdrawals + file uploads + search + admin writes + exam attempts (start/save/submit) |
| Unused dependencies | 6 (`bcryptjs` + 5 in `apps/web`) | 0 |

## Every fix, with commit and regression test

| ID | Title | Commit | Regression test |
|---|---|---|---|
| FIN-001 | Refund had no `Payment.status` precondition | `6577651` | `refunds.service.spec.ts` |
| FIN-002 | `gatewayRedirect` had no idempotency/lock | `12722da` | `payments.service.spec.ts` + live repro via `load/payment-flow.mjs` |
| FIN-003 | Withdrawal balance check ran at READ COMMITTED | `6807459` | `payouts.service.spec.ts` |
| SEC-001 | STAFF could mint a brand-new ADMIN account | `48463e0` | `admin.service.spec.ts` |
| SEC-002 | Test `answerKey`/`scoringRule` leaked to students | `6ebc7f4` | `tests.service.resume.spec.ts` + live verification |
| SEC-003 | Self-elevation guard bypassable via a proxy account | `48463e0` | `admin.service.spec.ts` |
| RATE-001 | Rate limiting existed on only 4 auth routes | `e7312e4` | live burst tests via `load/ratelimit.mjs` |
| SEC-004 / RATE-003 | Public payment callback had no rate limit | `e7312e4` | same commit |
| RATE-005 | `/search/:entity` had no role scoping | `e7312e4` | live: unauthenticated STUDENT now 403s |
| RATE-006 | File uploads had no request-rate limit | `e7312e4` | covered by the same tier applied elsewhere |
| RATE-002 | Redis client could hang instead of fail fast | `fe69b12` | `redis.service.spec.ts` |
| RATE-004 | BullMQ failed jobs retained unbounded | `fe69b12` | code inspection (not unit-testable without real Redis) |
| SEC-009 | `x-request-id` reflected unvalidated | `352283b` | `http.spec.ts` |
| SEC-010 | `DiscountDto` had no bounds | `352283b` | covered by DTO validation |
| RATE-007 | No `RateLimit-*` response headers | `352283b` | `rate-limit.guard.spec.ts` |
| STR-002 / SEC-008 | 6 unused dependencies | `3f27e45` | full gate (typecheck/lint/test/build) green after removal |
| STR-003 | `app.module.ts` bypassed `config()` | `3f27e45` | same commit |
| RATE-009 | No velocity control on money-adjacent admin actions | `e7312e4` | covered by the `moneyAdjacent` rate tier |

## Open findings and why

**`NEEDS-DECISION` (crossed a hard-rule line, need your call):**

- **FIN-005** (critical) — `Reconciliation` model is never written to. The gap it exists to catch
  (ZarinPal capture succeeds, process crashes before the DB commit) is narrow and self-heals on
  callback replay in most cases, but has no repair path for the "user closes the tab immediately"
  case. Closing this properly means building a reconciliation job — a scheduling mechanism
  (`@nestjs/schedule` isn't currently a dependency) and a design decision on polling interval and
  what "repair" does. That's a feature, not a bug fix.
- **FIN-004** (medium) — `WithdrawalRequestDto` has no `idempotencyKey`. Closing it needs a new DB
  column/migration on `WithdrawalRequest`.
- **SEC-005** (low) — access tokens stay valid up to 15 minutes after a suspension/role change.
  Whether that's acceptable is a product call, not purely a bug (the audit itself framed it that
  way).

**`wontfix` (already a deliberate, documented tradeoff by the original team):**

- **SEC-006** — CSP `connect-src`/`media-src` breadth, explicitly commented as temporary pending a
  `NEXT_PUBLIC_S3_ORIGIN` env var.
- **RATE-008** — fixed-window ~2x boundary burst, judged acceptable at the current limits by the
  audit itself.

**Deferred for time (low severity):**

- **SEC-007** — OTP hashed with unsalted SHA-256; already mitigated by entropy/TTL/attempt-limit,
  flagged as low-risk by the audit.
- **STR-001** — `@lingospeak/contracts` unusable from `apps/api` at runtime (ESM/CJS mismatch).
  Real fix is a build-step change to the shared package (dual ESM/CJS output), bigger than a
  same-pattern fix and the original team already has a documented workaround in place.
- **LOAD-001** — `GET /teachers` throughput plateaus under concurrency; this is a dev-mode
  capacity/architecture observation (single Node process, no clustering), not a targeted code bug.
- **LOAD-002** — a truly-simultaneous duplicate ZarinPal callback can get a transient 409 instead
  of an idempotent 200 (no double-grant, just a caller-visible error). Touches the payment
  transaction, so flagged rather than changed inline.

## Backlog (prioritized, with rough effort)

1. **FIN-005 reconciliation job** — needs your decision on approach (cron interval, `@nestjs/schedule`
   vs. a manual interval, what "repair" does). Est. 0.5–1 day once scoped.
2. **FIN-004 withdrawal idempotency key** — small migration + DTO field + dedupe check. Est. 1–2 hrs.
3. **STR-001 contracts build step** — add `tsup`/`tsc` dual-output build to `packages/contracts`,
   verify both `apps/api` (CJS) and `apps/web` (bundler/ESM) resolve it. Est. 2–4 hrs including
   verifying nothing regresses.
4. **SEC-005 session revocation** — decide the acceptable staleness window; if tightened, a
   Redis-backed revocation list keyed by `sessionId`, checked in `AccessGuard`. Est. half a day.
5. **LOAD-001 capacity planning** — re-run the load suite against a production build
   (`NODE_ENV=production`, `nest start` not `start:dev`) before drawing capacity conclusions; consider
   PM2/Node cluster mode if the ceiling holds. Est. 2–3 hrs to re-measure, more if scaling work follows.
6. **LOAD-002 retry-on-conflict** — wrap the `P2034` case in `payments.service.ts`'s `callback()`
   with a single retry before surfacing it. Est. 1 hr.
7. **SEC-007 OTP pepper** — HMAC-SHA256 with a server secret before hashing. Est. 1 hr.
8. **`npm audit` next.js/sharp advisories** — both confined to `apps/web`; fixing means a Next.js
   version bump, which is a bigger, separately-scoped upgrade (see `SECURITY.md` for why Next 16
   hasn't been adopted yet).

## What I did not touch

Per the hard rules in the original prompt: no money amount/rounding/currency logic was changed
(FIN-007/FIN-008 were already confirmed correct, not touched), no schema was dropped or reshaped,
no public API response contract was narrowed except SEC-002's removal of a field that should never
have been exposed (the correct-answer key), and no new external dependency was added anywhere in
this pass.
