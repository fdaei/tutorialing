# Phase 4 — Rate Limiting / DDoS / Backpressure Audit

Scope: `apps/api` only (NestJS 11 + Prisma + Redis/ioredis + BullMQ). No WAF/CDN/ingress
config exists in this repo — `docker-compose.yml` defines only `postgres`, `redis`,
`minio` services (`docker-compose.yml:1-33`), no reverse proxy / nginx / ingress
container. Any edge-level rate limiting, connection limits, or L7 DDoS mitigation
would have to be configured outside this repo; this audit only covers what the
Nest app itself does.

## 1. The limiter itself

**Implementation**: `apps/api/src/common/guards/rate-limit.guard.ts` +
`apps/api/src/common/redis.service.ts`.

- **Backing store**: Redis via `ioredis`, one dedicated client
  (`redis.service.ts:9`, `new Redis(config().REDIS_URL,{maxRetriesPerRequest:null})`).
- **Algorithm**: fixed window. `consume()` runs a single Lua script
  (`redis.service.ts:6`) that does `INCR` then, only on the first hit (`c==1`),
  arms `EXPIRE` — this is atomic (one `EVAL`, no separate round trips), so there
  is **no check-then-act race**: concurrent requests cannot both read a
  stale count and both pass. This correctly fixes the classic
  read-then-increment TOCTOU bug.
- **Window**: fixed, not sliding/token-bucket — `TTL` is set once per window and
  the counter resets hard at expiry (`redis.service.ts:6,14-17`), so a client can
  burst up to `2×limit` requests around a window boundary (e.g. all of one
  window's budget at `t=599s` and all of the next window's budget at `t=601s`).
  Documented as a design choice in the decorator's docstring
  (`rate-limit.decorator.ts:8`: "Length of the fixed window") — not flagged
  further as a bug, just noted as the actual algorithm (not sliding window,
  despite CLAUDE.md not making that specific claim).
- **Keying**: **IP-only**, never user id. `rate-limit.guard.ts:38-39` builds the
  key as `` `ratelimit:${bucket}:${clientIp(request)}` `` — `options.bucket`
  (shared across `otp/request`+`otp/resend`, see `auth.controller.ts:11`) plus
  IP, nothing else. There is no per-user-id keying anywhere in the guard, even
  on authenticated routes (moot today since only 4 auth routes have
  `@RateLimit` at all — see §3).
- **Response**: On limit exceeded, throws `tooManyRequests(...)` which maps to
  `HttpStatus.TOO_MANY_REQUESTS` (429) via `DomainException`
  (`errors.ts:24-25`), and `rate-limit.guard.ts:54` sets a bare
  `Retry-After` header before throwing. **No `RateLimit-Limit` /
  `RateLimit-Remaining` / `RateLimit-Reset` (or legacy `X-RateLimit-*`)
  headers are ever set** — only `Retry-After`. Minor client-ergonomics gap,
  not a security issue.
- **IP resolution / spoofing**: `clientIp()` (`rate-limit.guard.ts:65-70`) uses
  `request.ip`, which Express derives per the `trust proxy` setting.
  `main.ts:19` sets `app.set('trust proxy', cfg.TRUST_PROXY)` before any route
  handling, and `TRUST_PROXY` defaults to `0`
  (`env.validation.ts:36`, `.env.example:26`). With `trust proxy=0`, Express
  ignores `X-Forwarded-For` entirely and uses the raw socket address, so a
  client **cannot** spoof the limiter key by sending a forged
  `X-Forwarded-For` in the current default configuration — safe default,
  correctly commented on in both `env.validation.ts:31-35` and
  `rate-limit.guard.ts:66-68`. Because no reverse proxy exists in this repo's
  `docker-compose.yml`, `TRUST_PROXY=0` is also the *correct* value for the
  topology actually defined here. **Operational risk (not a code bug)**: if
  this is deployed behind a real reverse proxy/load balancer in production
  (nginx, ALB, Cloudflare) without also setting `TRUST_PROXY` to the correct
  hop count, every client will bucket under the proxy's IP and one abusive
  client will exhaust the OTP/refresh budget for all users behind that
  proxy — this is exactly what the code comment warns about but the repo has
  no proxy config to verify against, so it's a deployment-time responsibility,
  not something fixable in-repo.

### Fail-mode: does it actually fail closed with a fast 503?

`rate-limit.guard.ts:43-51` wraps `this.redis.consume(...)` in try/catch and on
any rejection throws `ServiceUnavailableException` (503) — this part is
correct and uniform across every route carrying `@RateLimit` (no
per-endpoint-class differentiation; same fail-closed path for OTP as for any
future payment-tier route that adopted the decorator).

However, **whether that catch block is ever reached quickly during a real
Redis outage is unverified and, per documented `ioredis` semantics, doubtful**:
the client is constructed with only `{maxRetriesPerRequest:null}`
(`redis.service.ts:9`) — no `enableOfflineQueue:false`, no `commandTimeout`,
no custom `retryStrategy`. `maxRetriesPerRequest:null` is `ioredis`'s
documented "never let a command fail due to retries" mode (it's the setting
BullMQ itself requires — see `queue.service.ts:40`, same value, same
rationale). Combined with `ioredis`'s default `enableOfflineQueue:true`, a
command issued while the connection is down does not reject — it sits in the
offline queue until the connection is reestablished, however long that
takes. If Redis is actually unreachable (not just slow), the practical effect
is **`await this.redis.consume(...)` hangs rather than throwing**, so the
try/catch's fail-closed 503 path may never fire in a timely way; instead the
HTTP request (and the connection/event-loop slot serving it) stays open
indefinitely. This is *worse* than a fast 503 for availability (it looks like
a hang, not a clean error) even though it's still "closed" in the sense that
no request gets through without being counted. **This contradicts the
code comment's implied "fails closed quickly" framing and CLAUDE.md's blanket
"fails closed (503) if Redis is unreachable" claim** — the exception path is
real and correct for slow-but-erroring cases (e.g. `ECONNREFUSED` on a
synchronous connect attempt, which is what the existing spec test simulates
via a rejected mock, see `rate-limit.guard.spec.ts:56-61`), but that spec only
exercises a mocked `consume` that rejects — it never exercises the real
`RedisService`/`ioredis` client, so the "does it truly reject quickly on a
real outage" question is **not covered by any test in this repo** and could
not be verified further in this read-only, no-docker phase. Flagged as a
finding (RATE-002) rather than a confirmed bug, since confirming it requires
an actual Redis outage test (out of scope here — that's a later load-test
phase).

### Fail-mode uniformity across endpoint classes

There is only one code path (`rate-limit.guard.ts:43-51`); it is applied
identically regardless of what the annotated route is. This means: **if any
`@Public()` read-only route (e.g. a hypothetical rate-limited `search`) were
ever put behind `@RateLimit`, a Redis blip would 503 that route too** — same
concern CLAUDE.md's prompt raises. Today this is moot in practice because, as
found below, **no route outside `auth.controller.ts` carries `@RateLimit` at
all**, so no read-only endpoint is currently exposed to this failure mode —
but it does mean the guard has no notion of "soft" vs "hard" limiting, so any
future adoption on a low-value read endpoint would inherit hard-fail
semantics by default.

## 2. Global registration

`app.module.ts:2` registers guards in this order via `APP_GUARD`:
`RateLimitGuard` → `AccessGuard` → `AuthorizationGuard`. Because Nest applies
`APP_GUARD` providers in registration order and `RateLimitGuard` does not
check `@Public()` at all (`rate-limit.guard.ts:29-34` only checks for
`RATE_LIMIT_KEY` metadata, never `PUBLIC_KEY`), it runs — and can reject —
before `AccessGuard` even looks at whether the route is public
(`access-token.guard.ts:13-15` is a *later* guard). Confirmed: rate limiting
does apply to `@Public()` routes such as `otp/request`/`otp/verify`/`refresh`
(`auth.controller.ts:15`), consistent with CLAUDE.md's claim and with the
class docstring at `rate-limit.guard.ts:14-18`.

## 3. Per-route inventory — THE key finding

`grep -rn "@RateLimit" apps/api/src/modules --include="*.controller.ts"`
matches **only `auth.controller.ts`**. Every other controller in
`apps/api/src/modules/*` (20 controller files: admin, availability, bookings,
commerce×4, files, languages, learning, matching, search, support×2,
teachers×4, tests×3, users) has **zero `@RateLimit` usage**. Constants are
defined locally in `auth.controller.ts:11-13`, not in a shared
`common/` location as the prompt's starting point speculated.

| route | key | limit | window | burst | fail-mode | why / gap |
|---|---|---|---|---|---|---|
| `POST /auth/otp/request` | IP (bucket `auth:otp-send`) | 10 | 600s | ~2× at window edge | 503 (see caveat §1) | shared bucket with `otp/resend` — `auth.controller.ts:11,15` |
| `POST /auth/otp/resend` | IP (bucket `auth:otp-send`, shared) | 10 | 600s | same | 503 | same bucket as above, intentional (`rate-limit.decorator.ts:11-14`) |
| `POST /auth/otp/verify` | IP (bucket `auth:otp-verify`) | 20 | 600s | ~2× | 503 | `auth.controller.ts:12,15`. IP-only — a botnet distributes across many IPs and gets 20 guesses each; no per-challenge/per-phone attempt cap visible at this layer (would need to check `auth.service.ts`, out of this phase's guard-level scope) |
| `POST /auth/refresh` | IP (bucket `auth:refresh`) | 60 | 600s | ~2× | 503 | `auth.controller.ts:13,15` |
| `POST /auth/logout` | — | none | — | — | n/a | not rate limited, low value target, acceptable |
| `POST /payments` (create) | — | **none found** | — | — | n/a | payment-init tier, authenticated but unlimited — `commerce.controller.ts:13-16` |
| `POST /payments/:id/gateway` | — | **none found** | — | — | n/a | payment-init (redirect to Zarinpal), triggers outbound call via `GatewayService.request` — `commerce.controller.ts:18-21`, `gateway.service.ts:22-30` |
| `GET /payments/callback` | — | **none found**, and `@Public()` | — | — | n/a | payment-callback tier, **unauthenticated, unlimited**, on a valid/pending payment can force a repeated outbound Zarinpal `verify` call per hit — `commerce.controller.ts:23-27`, `payments.service.ts:173-179` |
| `POST /payments/:id/refunds` | — | **none found** | — | — | n/a | admin/money-adjacent, role+permission gated (`Roles('ADMIN','FINANCE')`, `Permissions('payments.refund')`) but no velocity/rate control beyond that — `commerce.controller.ts:40-45` |
| `POST /payouts/generate`, `/payouts/:id/approve`, `/payouts/discounts`, `/payouts/withdrawals/:id/transfer` | — | **none found** | — | — | n/a | admin/money-adjacent, `Roles('ADMIN','FINANCE')` + `Permissions('payouts.manage')` gated but no rate limit or progressive-penalty logic — `payouts.controller.ts:9-38` |
| `POST /files/uploads`, `/files/uploads/:id/content`, `/files/:id/complete` | — | **none found** | — | — | n/a | file-upload tier, authenticated, per-file size capped at 50MB (`files.service.ts:44-51`, `upload.dto.ts:6`) but **no rate limit on how many uploads/sec a user can create** — `files.controller.ts:11-24` |
| `GET /search/:entity` | — | **none found** | — | — | n/a | search tier; requires auth (no `@Public()`, so `AccessGuard` demands a bearer token — `search.controller.ts:1-4`, `access-token.guard.ts:13-18`) but **any authenticated user, regardless of role**, can page (up to 50/page) through `users`, `payments`, `bookings`, `support-agents` via unindexed `contains`/`insensitive` filters (`search.service.ts:33-71`) with zero rate limit — cheap to script into a full-table scrape |
| `POST /tests/attempts`, `/attempts/:id/answers`, `/attempts/:id/sections/:id/submit`, `/attempts/:id/submit` | — | **none found** | — | — | n/a | exam-submission tier, authenticated, no rate limit — `tests.controller.ts:14-19` |
| `POST /admin/tests/*` (TestBuilderController, 12 routes) | — | **none found** | — | — | n/a | admin bulk-write tier; bodies typed `unknown` (intentional, see comment `tests.controller.ts:34-39`) but no rate limit on top of `Roles('ADMIN','STAFF')`+`Permissions('tests.manage')` — `tests.controller.ts:31-58` |
| `POST /admin/roles`, `/admin/permissions/grant`, `/admin/users/:id/roles`, `/admin/users/:id/status` | — | **none found** | — | — | n/a | admin/privilege-adjacent; guarded by `Roles`+`Permissions('roles.manage')` and by the service-layer self-escalation check (per CLAUDE.md) but no rate limit — `admin.controller.ts:35-83` |
| `GET /teachers`, `/teachers/:slug`, `GET /packages/teacher/:teacherId`, `GET /languages`, `GET /support/public-settings`, `/support/pages/:slug`, `GET /bookings/:teacherId/slots`, `GET /tests` | — | **none found**, all `@Public()` | — | — | n/a | public read tier (marketing/browse surface) — `teachers.controller.ts:10,33`, `packages.controller.ts:29-33`, `languages.controller.ts:10`, `support.controller.ts:12-13`, `availability.controller.ts:12`, `tests.controller.ts:13` — unlimited, scrapeable, availability-slot computation is the most likely to be non-trivial per call |
| signup | n/a | n/a | n/a | n/a | n/a | no separate signup endpoint — phone+OTP auto-provisions the user on first verified OTP (`sms.service.ts:23`, `ensureUser`); covered by the OTP tiers above |
| password-reset-equivalent | n/a | n/a | n/a | n/a | n/a | N/A — no password auth exists in this system (OTP-only, confirmed via `auth.controller.ts` and CLAUDE.md) |

## 4. BullMQ (`notifications` queue) — backpressure

`apps/api/src/modules/queue/queue.service.ts`:

- **Redis connection**: separate `ioredis`-shaped connection object built
  manually from `REDIS_URL` (`queue.service.ts:38-40`), **not** the same
  `RedisService` instance the rate limiter uses — two distinct TCP
  connections to the same Redis server/URL, not a shared client. Same
  `maxRetriesPerRequest:null` setting, for the BullMQ-mandated reason (queue
  jobs must never silently fail because a retry budget ran out).
- **Worker concurrency**: `5` (`queue.service.ts:76`, `{connection:this.connection,concurrency:5}`).
- **Retry/backoff**:
  - `booking-expiration` jobs: `attempts:3`, `backoff:{type:'exponential',delay:5000}` (`queue.service.ts:79`) — bounded, jittered only in the sense that exponential backoff is used (no explicit jitter, minor).
  - `booking-reminder` jobs: `attempts:5`, `backoff:{type:'exponential',delay:30000}` (`queue.service.ts:85`) — bounded.
- **Completion/failure retention**: `removeOnComplete:true` is set on both job
  types (`queue.service.ts:79,85`), but **`removeOnFail` is never set
  anywhere in this file** — BullMQ's default is to keep failed jobs
  indefinitely. Combined with no dead-letter queue or cleanup job, a
  sustained failure mode (e.g. Kavenegar down for a day) accumulates failed
  jobs in Redis without bound. This is the queue-depth/backpressure gap the
  prompt asked about — no queue-depth cap, no DLQ, unbounded failed-job
  retention.
- **Outbound call inside the worker has no timeout**: `queue.service.ts:65`
  (`fetch('https://api.kavenegar.com/...')`) has no `AbortSignal`/timeout
  option. A hung Kavenegar request occupies one of the 5 concurrency slots for
  as long as the request takes (bounded above by whatever the platform's
  default socket/header timeout is, which is not configured here), degrading
  reminder throughput but not crashing the process since concurrency is
  capped.

## 5. Outbound calls with no timeout

Every `fetch()` call found under `apps/api/src` passes no timeout/AbortSignal:

- `apps/api/src/modules/commerce/gateway.service.ts:25` (Zarinpal `payment/request.json`)
- `apps/api/src/modules/commerce/gateway.service.ts:36` (Zarinpal `payment/verify.json`)
- `apps/api/src/modules/auth/sms.service.ts:7` (Kavenegar OTP send — this one sits directly in the synchronous `otp/request`/`otp/verify` request path)
- `apps/api/src/modules/support/support.service.ts:194` (Kavenegar ticket notification)
- `apps/api/src/modules/queue/queue.service.ts:65` (Kavenegar reminder, inside BullMQ worker, see §4)

None of these have a circuit breaker or explicit timeout. The highest-impact
instance is `sms.service.ts:7`, because it runs synchronously inside the
`@RateLimit`-protected but still-reachable `otp/request` handler — a slow
Kavenegar response holds that HTTP request (and its DB connection / Node
socket) open for as long as Kavenegar takes, for every request that gets past
the rate limiter (up to 10 per 10 minutes per IP, but many IPs in a
distributed attack). `gateway.service.ts:36`'s `verify` call is the second
highest-impact instance because it's reachable from the **unauthenticated,
unlimited** `GET /payments/callback` route (see §3), and it never has a
timeout either.

## 6. Abuse controls beyond the generic limiter

No progressive-penalty, temp-ban, or velocity-limit logic exists anywhere in
`apps/api/src/common` or `apps/api/src/modules/commerce` beyond the flat
fixed-window `@RateLimit` on the four auth routes. Discount application
(`payouts.controller.ts:35-38`, `discounts.service.ts` not separately rate
limited), payout approval/transfer, and refund issuance all rely solely on
`Roles`/`Permissions` (identity/authorization) with no velocity control — i.e.
a compromised or malicious ADMIN/FINANCE account, or a bug that double-fires
a client-side retry, has no in-app rate ceiling on how many payouts/refunds/
discounts it can push per minute.

---

# Findings

### RATE-001 — CRITICAL — Rate limiting covers only 4 auth routes; every other controller (payments, files, search, admin, tests) has none
**Evidence**: `grep -rn "@RateLimit" apps/api/src/modules --include="*.controller.ts"` matches only `apps/api/src/modules/auth/auth.controller.ts:15`. Confirmed by direct reads of `apps/api/src/modules/commerce/commerce.controller.ts`, `apps/api/src/modules/commerce/payouts.controller.ts`, `apps/api/src/modules/files/files.controller.ts`, `apps/api/src/modules/search/search.controller.ts`, `apps/api/src/modules/admin/admin.controller.ts`, `apps/api/src/modules/tests/tests.controller.ts` — none import or use `RateLimit`.
**Impact**: Payment creation/gateway-redirect, the public payment callback, file uploads, the multi-entity search endpoint, admin bulk operations, and exam-attempt submission can all be hit at unlimited request rates by any client that can reach the network (or, for authenticated routes, by any valid session). This is the single largest gap in the phase — the `@RateLimit`/`RateLimitGuard` machinery is solid (see §1) but essentially unused outside auth.
**Minimal fix**: Add `@RateLimit(...)` to at minimum: `POST /payments`, `POST /payments/:id/gateway`, `GET /payments/callback` (payment tier), `POST /files/uploads` + `/uploads/:id/content` (file-upload tier), `GET /search/:entity` (search tier), and the `TestBuilderController`/`AdminController` write routes (admin tier). Bucket payment-callback distinctly since it's `@Public()`.

### RATE-002 — HIGH — Rate limiter's Redis client (`maxRetriesPerRequest:null`, default `enableOfflineQueue:true`) likely hangs rather than fails fast on a real Redis outage, contradicting the documented/CLAUDE.md "fails closed (503)" behavior
**Evidence**: `apps/api/src/common/redis.service.ts:9` — `new Redis(config().REDIS_URL,{maxRetriesPerRequest:null})`, no `enableOfflineQueue:false`, no `commandTimeout`. `apps/api/src/common/guards/rate-limit.guard.ts:43-51` only catches command *rejections*, which this configuration is designed to avoid producing during an outage (per `ioredis`'s documented semantics for `maxRetriesPerRequest:null` + default offline queueing). `apps/api/src/common/guards/rate-limit.guard.spec.ts:56-61` only exercises a mocked `consume` that rejects — the real `ioredis` client's outage behavior is untested in this repo.
**Impact**: If confirmed under a real outage (not verified in this read-only phase — would require a load-test/chaos phase), a Redis blip doesn't cleanly 503 OTP/refresh traffic, it hangs those requests, tying up server resources for longer than a fast-fail would, which is a worse availability outcome than what the code comments and CLAUDE.md describe.
**Minimal fix**: Either set `enableOfflineQueue:false` on the `RedisService` client (or a second dedicated client for rate-limiting only) so commands reject immediately when disconnected, or wrap `consume()` calls with an explicit timeout (`Promise.race` against a short deadline) before treating it as unreachable. Recommend verifying with an actual outage test in a later phase before changing behavior blind.

### RATE-003 — HIGH — Unauthenticated payment callback (`GET /payments/callback`) has no rate limit and can trigger a real outbound Zarinpal API call with no timeout
**Evidence**: `apps/api/src/modules/commerce/commerce.controller.ts:23-27` (`@Public()`, no `@RateLimit`); `apps/api/src/modules/commerce/payments.service.ts:173-179` calls `this.gateway.verify(...)` for any payment still in a settleable state; `apps/api/src/modules/commerce/gateway.service.ts:36` issues that `fetch` with no timeout.
**Impact**: A user with a real pending payment (which they always have, since they initiated it) can loop-call this endpoint with no rate limit, forcing the API to make repeated outbound Zarinpal calls (each un-timed-out) for as long as the payment stays in a settleable state (e.g. during a Zarinpal outage where `verify` keeps failing). This is an amplification vector on top of the missing timeout from RATE-001/§5.
**Minimal fix**: Add `@RateLimit` (IP + consider payment-id in the bucket) to the callback route, and add a request timeout to `gateway.service.ts`'s `fetch` calls.

### RATE-004 — MEDIUM — BullMQ `notifications` queue has no `removeOnFail`, no dead-letter handling, and no queue-depth cap
**Evidence**: `apps/api/src/modules/queue/queue.service.ts:79` and `:85` — both `queue.add(...)` calls set `removeOnComplete:true` but never `removeOnFail`; BullMQ's default keeps failed jobs in Redis indefinitely. No dead-letter queue, no max-jobs setting, anywhere in `queue.service.ts` or `queue.module.ts`.
**Impact**: A sustained upstream failure (Kavenegar down, DB issue) accumulates failed jobs without bound, growing Redis memory over time with no automated cleanup — a self-inflicted resource-exhaustion path, not attacker-triggered but still a backpressure gap the prompt asked about.
**Minimal fix**: Set `removeOnFail:{count:N}` (or an age-based policy) on both job types, and/or add an operational job to periodically drain/alert on the failed set.

### RATE-005 — MEDIUM — `GET /search/:entity` is rate-limit-free, has no role restriction, and lets any authenticated user page through `users`/`payments`/`bookings`/`support-agents` via unindexed `contains` filters
**Evidence**: `apps/api/src/modules/search/search.controller.ts:1-4` — no `@RateLimit`, no `@Roles`/`@Permissions` on the class or method (only implicit auth via the global `AccessGuard`, since there's no `@Public()`). `apps/api/src/modules/search/search.service.ts:33-71` builds `contains`/`insensitive` `OR` filters across `users`, `payments`, `bookings`, `support-agents` — sensitive tables — for any caller who can produce a valid bearer token.
**Impact**: Primarily an authorization gap (any authenticated user, not just admin/staff, can query the `payments`/`users`/`support-agents` search entities) that is compounded by the total absence of rate limiting — an authenticated attacker can script full-table scrapes at up to 50 rows/request indefinitely. The authz half of this is adjacent to this phase (flagging for cross-reference) but the missing rate limit is squarely in scope.
**Minimal fix**: Add `@Roles`/`@Permissions` scoping per entity (at minimum for `users`/`payments`/`support-agents`/`bookings`) and add `@RateLimit` to the route.

### RATE-006 — LOW — File upload routes have a per-file 50MB size cap but no request-rate limit
**Evidence**: `apps/api/src/modules/files/files.controller.ts:11-24` — no `@RateLimit` on `uploads`, `uploads/:id/content`, or `:id/complete`. Size is capped at `apps/api/src/modules/files/files.service.ts:44-51` (`> 50*1024*1024` rejected) and `apps/api/src/modules/files/dto/request/upload.dto.ts:6` (`@Max(52428800)`).
**Impact**: An authenticated user can create unlimited `PENDING` upload DB rows via `createUpload`, or repeatedly stream 50MB payloads through `uploadContent` (which proxies bytes through the API to S3/MinIO, `files.service.ts` — not just a client-to-S3 direct presigned PUT for that particular route), with no throttle — bandwidth/storage cost multiplier with no rate cap.
**Minimal fix**: Add `@RateLimit` to `POST /files/uploads` (and consider a per-user daily storage quota at the service layer, outside this guard's scope).

### RATE-007 — LOW — No `RateLimit-*`/`X-RateLimit-*` response headers, only bare `Retry-After`
**Evidence**: `apps/api/src/common/guards/rate-limit.guard.ts:53-60` sets only `Retry-After`; no limit/remaining/reset headers on success or failure responses.
**Impact**: Minor — well-behaved clients (including LingoSpeak's own web app) can't proactively back off before hitting 429; not a security gap, a UX/observability one.
**Minimal fix**: Have `RedisService.consume` return the configured limit alongside count/TTL and set `RateLimit-Limit`/`RateLimit-Remaining`/`RateLimit-Reset` headers on every rate-limited response (success and failure).

### RATE-008 — LOW — Fixed-window algorithm allows ~2× burst at window boundaries
**Evidence**: `apps/api/src/common/redis.service.ts:6,14-17` — classic fixed-window `INCR`+`EXPIRE`, not sliding-window or token-bucket.
**Impact**: A client can send `limit` requests at the tail of one window and another `limit` at the head of the next, achieving up to 2× the intended rate briefly. Applies to all four `@RateLimit`-protected auth routes (OTP send/verify, refresh).
**Minimal fix**: Not necessarily worth fixing given the limits involved (10-60 per 10 min) — noted for completeness; a sliding-window-counter or token-bucket algorithm would close it if the OTP limits are ever judged too generous.

### RATE-009 — INFO — No abuse-velocity or progressive-penalty controls on money-adjacent admin actions (discounts, payouts, refunds)
**Evidence**: `apps/api/src/modules/commerce/payouts.controller.ts:9-38`, `apps/api/src/modules/commerce/commerce.controller.ts:40-45` — protected only by `Roles`/`Permissions`, no `@RateLimit`, no velocity/temp-ban logic found anywhere in `apps/api/src/common` or `apps/api/src/modules/commerce`.
**Impact**: Low likelihood (requires a privileged account) but no defense-in-depth if such an account is compromised or a client bug double-fires requests.
**Minimal fix**: Consider a coarse `@RateLimit` on payout/discount/refund mutation routes as defense-in-depth; not urgent given the role gate already in place.
