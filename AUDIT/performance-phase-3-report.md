# Phase 3 — Backend performance & scalability audit

Report only, per instruction — **no code was changed while producing this document.** Baseline
commit: `501f150` (Phase 2 security hardening). Method: read every model in `apps/api/prisma/schema.prisma`
(69 models) against the actual query shapes in the service layer that filter/sort/join on them;
grepped for sequential-loop-over-await patterns across `apps/api/src/modules`; reviewed `main.ts`,
`docker-compose.yml`, `redis.service.ts`, `queue.service.ts`, and the logging config; and pulled live
`EXPLAIN` plans against the running dev database for two representative queries.

**A note on the `EXPLAIN` evidence.** The seeded dev database has 10 rows in `Payment`, 13 in
`Teacher`, 5 in `Ticket`, 26 in `User`. At that scale PostgreSQL's planner correctly prefers a
sequential scan over an index scan regardless of whether a supporting index exists — the crossover
point is typically in the hundreds-to-thousands-of-rows range, not tens. So the `Seq Scan` plans
below are **not** proof of a production-scale problem by themselves; they're included to show the
exact query shape actually executed, and the findings' severity is argued from the query shape (an
unindexed filter/sort column, or a pattern like `ILIKE '%x%'` that no B-tree index can accelerate at
all, regardless of table size) rather than from the local `EXPLAIN` output. No load test against a
production build was run this pass — `LOAD-001` (inherited, see below) already flagged that gap, and
this pass's job was root-causing it, not re-measuring it.

---

## Strengths found (for balance — not every query is a problem)

- **`DashboardStatsService`** (`apps/api/src/modules/admin/dashboard-stats.service.ts`) is a
  materialized-projection pattern done well: the read path (`dashboard()`) is two cheap queries (a
  PK lookup + a `take: 8` list) in one transaction, while the expensive aggregation (`COUNT`/`SUM`
  across `User`/`Teacher`/`TestAttempt`/`Booking`/`Payment`/`WalletEntry`) runs on a schedule via
  `@Interval`, guarded by a Postgres advisory lock so it's single-flight across replicas, and never
  runs inline with a user request. This is exactly the right shape for an admin dashboard and was
  deliberately checked first in case it was the obvious N+1 candidate it resembles from the outside.
- **Indexing on the money/scheduling-critical tables is good**: `Booking` has
  `@@index([teacherId, startsAt, endsAt])` and `@@index([studentId, startsAt, endsAt])` (the
  double-booking-prevention path), `WalletEntry` has `@@index([userId, createdAt])`,
  `TestAttempt` has `@@index([userId, createdAt])`, `Teacher` has `@@index([status, approvedAt])`
  and `@@index([status, rating])` (the two default-sort teacher-directory paths). These all show the
  team indexed the hot paths they were thinking about — the gaps below are mostly paths that grew
  around those (a new filter/sort option, a table added later) rather than a blanket oversight.
- **Logging is production-appropriate**: `pino` (not a synchronous console-based logger), redaction
  of tokens/secrets/cookies configured, `pino-pretty`'s (slower, human-formatted) transport gated
  behind a dev-only flag so production gets raw JSON, health-check request logging separately
  toggleable to cut noise. Not a finding.
- **`search.service.ts`'s `$transaction([findMany, count])` pairing** for every paginated list keeps
  the count and the page consistent with each other under concurrent writes — a correctness good
  practice that also happens to avoid an extra round trip that a naive two-call sequential version
  would add.

---

## Findings

### PERF-301 — No index supports `GET /teachers`' text search, and none can (root cause of LOAD-001) — **HIGH**

- **Location:** `apps/api/src/modules/teachers/teachers.service.ts:43-49` (`directory()`'s `search`
  filter) — `OR: [{nameFa: {contains, insensitive}}, {nameEn: ...}, {bioFa: ...}, {bioEn: ...}]`.
- **Current behavior:** Prisma compiles `contains` + `insensitive` to Postgres `ILIKE '%term%'`.
  Confirmed live: `EXPLAIN SELECT * FROM "Teacher" WHERE status='APPROVED' AND ("nameFa" ILIKE
  '%ali%' OR "nameEn" ILIKE '%ali%' OR "bioFa" ILIKE '%ali%' OR "bioEn" ILIKE '%ali%')` plans as
  `Seq Scan on "Teacher" ... Filter: (status = 'APPROVED' AND (nameFa ~~* '%ali%' OR ...))`. A
  leading-wildcard `ILIKE` **cannot use a standard B-tree index at all**, including the
  `@@index([status, approvedAt])`/`@@index([status, rating])` indexes that already exist — those
  only help when `search` is absent. The `skill` filter (`languageLinks: {some: {specialties:
  {has: skill}}}`, an array-containment check inside a relation subquery) and the `price_asc` sort
  (`orderBy: {approvedTrialPrice: 'asc'}`, no `@@index([status, approvedTrialPrice])`) have the same
  gap for a different reason: no composite index matches those access patterns either.
- **Performance impact:** Every `GET /teachers?search=...` request sequentially scans and
  pattern-matches the entire `Teacher` table across four text columns. This scales linearly with
  teacher count and directly explains the previously-recorded, previously-unexplained **`LOAD-001`**
  finding ("`GET /teachers` throughput plateau... dev-mode capacity measurement, needs
  re-measurement against a production build") — the plateau is very likely this query shape, not a
  dev-mode artifact, though a production-build re-measurement (LOAD-001's own ask, still open) is
  the way to confirm the magnitude.
- **Recommended solution:** Add a `pg_trgm` GIN index (`CREATE EXTENSION pg_trgm;` then
  `CREATE INDEX ... USING GIN ("nameFa" gin_trgm_ops)`, one per searched column, or a single
  generated `tsvector` column with a GIN index and Postgres full-text search instead of four
  `ILIKE`s) to make the search filter index-assisted; add `@@index([status, approvedTrialPrice])`
  for the price sort. The `skill`-via-`languageLinks` path is better served by moving `specialties`
  onto `TeacherLanguage` with its own GIN index if it's a common filter, or documenting it as an
  accepted cost if rarely used with `search` simultaneously.
- **Implementation complexity:** Medium. Trigram indexes need a Postgres extension enabled (a
  migration, no application code change) and a decision on whether the extension is available in the
  target hosting environment (it ships with standard Postgres but may need superuser/extension
  allowlisting depending on host). The `tsvector` alternative is more work (a generated column +
  migration + query rewrite) but scales better and supports relevance ranking later.
- **Expected improvement:** Qualitative, not measured — a GIN-trigram-assisted `ILIKE` typically
  turns an O(n) sequential scan into an index probe whose cost grows with match count rather than
  table size; the practical effect is that `GET /teachers?search=` stops degrading as the teacher
  count grows, rather than a specific millisecond figure this pass can respons

ibly claim without a
  production-scale benchmark.

### PERF-302 — `Payment` has no index on `userId` — **HIGH**

- **Location:** `apps/api/prisma/schema.prisma:631-665` (`Payment` model — `@@index([discountId])`
  and `@@index([discountRuleId])` exist; no index on `userId`, the column three services filter by).
- **Current behavior:** `WalletService.invoices(userId)` (`payments/wallet.service.ts:24-31`,
  backing `GET /payments/invoices`) runs `db.payment.findMany({where: {userId}, orderBy:
  {createdAt: 'desc'}, take: 100})` with no supporting index. Confirmed live:
  `EXPLAIN SELECT * FROM "Payment" WHERE "userId" = 'x' ORDER BY "createdAt" DESC LIMIT 100` plans
  as `Seq Scan on "Payment" ... Filter: (userId = 'x')` (with a `Sort` step on top, since there's
  also no `[userId, createdAt]` composite to satisfy the `ORDER BY` for free). The sibling
  `WalletEntry` model, right next to `Payment` in the same file, already has exactly this shape —
  `@@index([userId, createdAt])` — making this look like an oversight specific to `Payment` rather
  than a considered decision.
- **Performance impact:** Every invoice list, plus `AdminService.userDetail()`'s nested `payments:
  {take: 5, orderBy: {createdAt: 'desc'}}` relation fetch (`admin.service.ts:71-75`) and
  `PaymentsService.gatewayRedirect`'s `findFirstOrThrow({where: {id, userId, status}})` (the `id`
  half is a PK match so this one is less exposed, but still), scans the full `Payment` table. This
  is a money-adjacent, user-facing read path (a student checking their payment history), and the
  table only grows over time with no deletion path.
- **Recommended solution:** `@@index([userId, createdAt])` on `Payment`, mirroring `WalletEntry`
  exactly. One-line schema change plus a migration.
- **Implementation complexity:** Trivial — additive index, no query code changes needed, no
  behavior change, safe to add live with `CREATE INDEX CONCURRENTLY` in production to avoid locking
  the table.
- **Expected improvement:** Turns an O(n) table scan into an O(log n) index lookup for every wallet
  invoice/history read; the `ORDER BY createdAt` is satisfied directly from the index instead of a
  separate sort step. Effect size scales with `Payment` table size — negligible today (10 seed rows),
  meaningful once the table reaches the thousands-of-rows range a real user base would produce.

### PERF-303 — `Ticket` has no index on `userId` — **MEDIUM-HIGH**

- **Location:** `apps/api/prisma/schema.prisma:1097-1117` (`Ticket` model — indexed on
  `[status, updatedAt]` and `[assignedToId, status]`, i.e. the staff queue views; not on `userId`,
  the column a non-staff caller's list is filtered by).
- **Current behavior:** `SupportService.list()` (`support.service.ts:53-72`, backing
  `GET /support/tickets`) builds `where: staff ? {} : {userId}` for every non-staff caller — the
  common case (every student/teacher checking their own tickets). Confirmed via `\d "Ticket"` in the
  live database: no index involving `userId` exists.
- **Performance impact:** Same shape as PERF-302 — full-table scan for the single most common
  caller of this endpoint (a non-staff user), while the *less common* staff-queue views are the ones
  actually indexed.
- **Recommended solution:** `@@index([userId, createdAt])` (or `[userId, updatedAt]` to match the
  existing staff-queue index's sort convention) on `Ticket`.
- **Implementation complexity:** Trivial — same shape as PERF-302.
- **Expected improvement:** Same reasoning as PERF-302, scaled to `Ticket` row counts.

### PERF-304 — `User` has no index supporting the admin/search listing's filter+sort — **MEDIUM**

- **Location:** `apps/api/prisma/schema.prisma:177-217` (`User` model — no `@@index` at all beyond
  the automatic ones for `@id` and `@unique(phone)`); consumed by `AdminService.users()`
  (`admin.service.ts:49-63`, via `AdminRepository`) and `SearchService.users()`
  (`search.service.ts:56-86`), both of which filter on `status` and sort `orderBy: {updatedAt:
  'desc'}`.
- **Current behavior:** An empty-query admin/search user listing (the default "show me all users,
  page 1" view) has no `WHERE` clause narrow enough to avoid touching every row, and no index to
  satisfy `ORDER BY updatedAt DESC` without a full sort.
- **Performance impact:** Lower urgency than PERF-302/303 because `User` rows are the least
  frequently mutated (created once at signup, occasionally updated) and this is an admin-only,
  lower-QPS surface than a student-facing wallet/ticket list — but the same linear-degradation
  argument applies as the user base grows.
- **Recommended solution:** `@@index([status, updatedAt])` covers both the common filtered case and
  the sort order in one index.
- **Implementation complexity:** Trivial.
- **Expected improvement:** Same category as PERF-302/303, lower priority given current traffic
  shape (admin/internal tooling, not a public or high-frequency path).

### PERF-305 — Payout-batch transfer processes items sequentially inside one long transaction — **MEDIUM-HIGH**

- **Location:** `apps/api/src/modules/commerce/payouts/payouts.service.ts:84-99` — inside a
  `$transaction`, `for (const item of batch.items) { const teacher = await
  tx.teacher.findUniqueOrThrow(...); await tx.walletEntry.upsert(...); }`.
- **Current behavior:** For a batch of N payout items, this issues 2N sequential round trips to
  Postgres (`findUniqueOrThrow` then `upsert`, one pair per item, awaited one at a time), all inside
  a single open transaction.
- **Performance impact:** Two compounding costs: (1) 2N sequential round trips is slower than it
  needs to be even outside a transaction; (2) because it's *inside* a transaction, every row this
  loop touches stays locked for the full duration of all N iterations, not just its own iteration —
  a large batch (a monthly payout run across many teachers, the scenario this code exists for) holds
  locks on that many `Teacher`/`WalletEntry` rows for the whole loop's wall-clock time, increasing
  contention with anything else touching those rows (e.g., a teacher's own wallet read) and raising
  the odds of hitting a statement/transaction timeout on a large batch.
- **Recommended solution:** Batch the teacher lookup up front — one
  `tx.teacher.findMany({where: {id: {in: batch.items.map(i => i.teacherId)}}, select: {id: true,
  userId: true}})` before the loop, building an in-memory `teacherId -> userId` map — removing N of
  the 2N round trips. The `walletEntry.upsert` calls still need to run per-item (each has a distinct
  `idempotencyKey`), but could run concurrently (`Promise.all`) now that they no longer depend on a
  sequential per-item read, or via Prisma's `createMany` if the idempotency semantics genuinely only
  ever mean "insert, never update" in practice (worth confirming before switching, since
  `createMany` doesn't support upsert semantics).
- **Implementation complexity:** Low-Medium — the teacher-lookup batching is a small, mechanical
  change; parallelizing the upserts needs a quick check that concurrent writes inside one
  transaction are safe here (they should be — different rows, no shared mutable state) before
  switching `for...await` to `Promise.all`.
- **Expected improvement:** Removes N round trips outright (the teacher lookups) and shortens the
  transaction's wall-clock duration roughly in proportion to batch size, directly reducing lock hold
  time on the rows it touches.

### PERF-306 — Matching questionnaire computes availability for up to 40 teachers sequentially — **MEDIUM-HIGH**

- **Location:** `apps/api/src/modules/matching/matching.service.ts:55-58` — `const teachers =
  await this.db.teacher.findMany({..., take: 40}); for (const teacher of teachers) { const slots =
  await this.availability.slots(teacher.id, ...); ... }`.
- **Current behavior:** `POST /matching` (the student-facing "find me a teacher" questionnaire,
  a `SELF_SCOPED` route with no rate limit per `02-route-matrix.md`) fetches up to 40 candidate
  teachers, then computes each one's available slots **one at a time**, awaiting each before
  starting the next. `AvailabilityService.slots()` itself queries `AvailabilityRule`,
  `AvailabilityOverride`, `BlockedPeriod`, and existing `Booking` rows per teacher — so this is up to
  40 sequential rounds of several queries each.
- **Performance impact:** This is on the critical path of a user-facing, synchronous request (the
  student is waiting for their match results), unlike PERF-305/307 which are background jobs. Each
  candidate's availability computation is fully independent of every other's — there's no ordering
  or shared-state dependency between iterations — so the sequential `await` in the loop buys no
  correctness benefit, only serializes work that could run concurrently.
- **Recommended solution:** `Promise.all(teachers.map(teacher => this.availability.slots(...)))`
  (or a bounded-concurrency variant, e.g. `p-limit`, if 40 concurrent DB round trips risks exhausting
  the connection pool — see PERF-308, connection pool sizing is the actual constraint to check before
  going fully unbounded).
- **Implementation complexity:** Low — the loop body has no cross-iteration dependency, so this is a
  mechanical `for...await` to `Promise.all` conversion; the only care needed is confirming pool
  capacity (PERF-308) can absorb the resulting concurrency burst.
- **Expected improvement:** In principle turns O(40 × per-teacher latency) into roughly
  O(per-teacher latency) wall-clock time for this loop, bounded by whichever teacher's computation
  is slowest rather than their sum — the single largest, most direct user-facing latency win in this
  report, though the actual number depends on connection pool headroom (PERF-308) and each
  `availability.slots()` call's own cost, neither measured this pass.

### PERF-307 — Reconciliation/settlement sweeps process candidates sequentially — **LOW-MEDIUM**

- **Location:** `apps/api/src/modules/commerce/payments/payments.service.ts:62-67` (a
  stale-payment settlement sweep: `for (const payment of payments) { await this.callback(...) }`)
  and `apps/api/src/modules/commerce/payments/reconciliation.service.ts:88-104`
  (`ReconciliationService.reconcile()`: `for (const payment of candidates) { ... await
  this.verify(payment); ... }`) — both loops call out to the payment gateway (Zarinpal) per
  iteration, one at a time.
- **Current behavior:** Both are scheduled background sweeps (per `CLAUDE.md`, a 10-minute `@Cron`,
  Redis-locked to one instance), not user-facing requests, bounded by a configured batch size.
- **Performance impact:** Lower urgency than PERF-305/306 specifically because nothing user-facing
  is waiting on these — the cost is sweep *throughput* (how many stale/candidate payments get
  processed before the next scheduled run), not request latency. If the gateway round trip is slow
  or the batch size is large, a sequential sweep could in principle take long enough to still be
  running when the next scheduled invocation starts (mitigated by the existing Redis lock, which
  would just skip the overlapping run rather than double-process — a correctness safeguard already
  in place, but it means an overloaded sweep silently does less work per unit time rather than
  failing loudly).
- **Recommended solution:** Bounded-concurrency processing (e.g., `Promise.allSettled` over chunks
  of 5-10) instead of one full pass. Full unbounded parallelism is probably wrong here — reconciling
  against an external payment gateway too aggressively risks tripping its own rate limits.
- **Implementation complexity:** Low-Medium — needs a concurrency-limiting helper (or a small
  dependency like `p-limit`) plus care that the existing per-payment error isolation (a `try/catch`
  per item so one failure doesn't abort the sweep) is preserved under concurrent execution.
- **Expected improvement:** Increases sweep throughput per scheduled run in proportion to the chosen
  concurrency factor; the ceiling is the external gateway's own capacity, not this service.

### PERF-308 — No database connection pool tuning — **LOW-MEDIUM**

- **Location:** `apps/api/.env:6` / `apps/api/prisma/schema.prisma:5-8` — `DATABASE_URL` carries only
  `?schema=public`, no `connection_limit`/`pool_timeout` query parameters; `prisma.service.ts` uses
  the default `PrismaClient` with no explicit datasource override.
- **Current behavior:** Prisma's default connection pool size is `num_physical_cpus * 2 + 1` per
  `PrismaClient` instance. With one API process this is usually reasonable; it becomes a real risk
  the moment the API runs as more than one instance/replica (each opens its own pool) against
  Postgres's own `max_connections` (default 100), or if PERF-306's `Promise.all` change (or any
  other newly-parallelized path in this report) is adopted without checking the resulting
  concurrent-connection burst against pool capacity.
- **Performance impact:** Not a current, observed problem in this single-instance dev environment —
  flagged because it's a precondition for safely adopting several of this report's own
  recommendations (PERF-305, PERF-306, PERF-307 all increase concurrent query volume) and because
  connection-pool exhaustion under horizontal scaling is one of the most common Prisma
  production incidents.
- **Recommended solution:** Set an explicit `connection_limit` (sized to the deployment's actual
  Postgres `max_connections` divided across expected replica count) and `pool_timeout` on
  `DATABASE_URL`, and revisit it whenever a change increases per-request concurrent query count.
- **Implementation complexity:** Trivial (a connection-string parameter, no code change) but requires
  an operational decision (target replica count, Postgres's actual `max_connections`) this audit
  can't make unilaterally.
- **Expected improvement:** Not a throughput win by itself — a guardrail against connection
  exhaustion once traffic or replica count grows, and a prerequisite check before adopting
  PERF-306/307's concurrency recommendations at their full width.

### PERF-309 — OTP request blocks the HTTP response on the SMS provider's API call — **MEDIUM**

- **Location:** `apps/api/src/modules/auth/auth.service.ts:74` (`requestOtp`) —
  `const sent = await this.sms.sendOtp(phone, code, user.id);` — and
  `apps/api/src/modules/auth/sms.service.ts:12-16`, which does a synchronous `fetch(...)` to the
  Kavenegar API before `sendOtp()` returns.
  - **Current behavior:** `POST /auth/otp/request`/`/otp/resend` don't respond to the client until
  the external SMS provider's API call completes.
- **Performance impact:** Every OTP request's latency is the sum of this service's own work plus a
  third-party HTTP round trip outside its control. This is already rate-limited (`OTP_SEND_LIMIT`),
  so it isn't an amplification/DoS concern, purely a user-facing latency one — the "enter your
  phone number" screen waits on Kavenegar's response time.
  - **Recommended solution:** Genuinely has a tradeoff, not a free win: backgrounding the SMS send
  (queue it via the existing `QueueService`/BullMQ infrastructure, respond once the `OtpChallenge`
  row is persisted) removes the provider round trip from response latency, but means the client
  gets a "sent" response before knowing whether the provider actually accepted it — the current
  code's `ServiceUnavailableException` on a Kavenegar failure (fail-closed, per `CLAUDE.md`) would
  need to become an async failure surfaced some other way (a follow-up notification, a status the
  client polls) rather than the request's own error response. Worth a product decision, not a
  drop-in change.
  - **Implementation complexity:** Medium — the mechanical part (moving the `fetch` into a queued
  job) is small given `QueueService` already exists; the harder part is deciding and implementing
  how a provider-side failure is communicated once it's no longer synchronous with the request.
  - **Expected improvement:** Removes the SMS provider's round-trip time from `/auth/otp/request`'s
  response latency entirely — the single largest per-request latency component this endpoint has,
  once the fail-closed-error-surfacing tradeoff above is resolved.

### PERF-310 — No caching layer despite Redis already being available — **HIGH**

- **Location:** `apps/api/src/infrastructure/cache/redis.service.ts` — exposes exactly two
  primitives, `lock()` (distributed locks) and `consume()` (rate-limit counters); no `get`/`set`/
  `getOrSet` cache helper exists anywhere in the codebase.
- **Current behavior:** Every request recomputes its answer from Postgres, including reads over
  data that changes rarely relative to how often it's read: `GET /teachers`/`GET /teachers/:slug`
  (public, unauthenticated, the site's highest-traffic read), `GET /languages` (near-static reference
  data), `GET /support/public-settings` (`Setting` rows filtered `public: true`), CMS pages
  (`GET /support/pages/:slug`).
- **Performance impact:** This is the largest structural opportunity in this report — Redis is
  already deployed, already wired into every request via `RedisService`, and used for exactly two
  narrow purposes. None of the read-heavy, low-write-frequency public data gets any benefit from it.
  Under real traffic, the public teacher directory (the page most visitors hit first) recomputes its
  query (itself affected by PERF-301) on every single request from every visitor.
- **Recommended solution:** Add a generic `getOrSet(key, ttlSeconds, fn)` helper to `RedisService`
  (or a small new `CacheService` alongside it, to keep `RedisService`'s existing narrow contract
  intact) and apply it to the read paths above, with a TTL short enough that staleness after an
  admin edit (a teacher approval, a CMS publish, a setting change) is acceptable, or paired with
  explicit invalidation on write (the admin mutation paths for these resources already exist and
  could publish a cache-bust alongside their DB write).
- **Implementation complexity:** Medium. The caching primitive itself is small; the real work is
  per-endpoint — choosing TTL vs. invalidate-on-write per resource, and making sure paginated/query
  variants of `GET /teachers` don't produce unbounded cache-key cardinality (cache the common,
  unfiltered "page 1, default sort" case rather than every possible filter combination, for example).
- **Expected improvement:** For a cache-hit, turns a full query (plus, for `/teachers`, the
  currently-unindexed search cost from PERF-301) into a single Redis `GET` — typically an
  order-of-magnitude-or-more latency reduction for cached paths, and a proportional reduction in
  Postgres load for the site's highest-traffic reads. Actual hit rate (and thus real-world benefit)
  depends on traffic patterns not measured this pass.

### PERF-311 — No HTTP `Cache-Control` headers on public, cacheable responses — **LOW-MEDIUM**

- **Location:** Grepped `apps/api/src` for `Cache-Control`/`cache-control` — no matches anywhere.
- **Current behavior:** Every response, including genuinely public and cacheable ones
  (`GET /teachers`, `GET /languages`, `GET /support/public-settings`, `GET /support/pages/:slug`),
  is served with no caching directive, so a browser or any CDN in front of the API has no signal
  that it's safe to reuse a response.
- **Performance impact:** Complementary to PERF-310 (server-side caching) rather than a substitute —
  this is about letting the *client*/CDN skip the request entirely, which server-side caching alone
  can't do. Lower severity than PERF-310 because it requires the same per-resource staleness
  decisions before it's safe to add.
- **Recommended solution:** A short `Cache-Control: public, max-age=<n>` (with or without
  `stale-while-revalidate`) on the specific public, non-personalized GET routes above, set at the
  controller level; nothing authenticated/personalized should get one.
- **Implementation complexity:** Low once PERF-310's staleness-tolerance decisions are made per
  resource — the header itself is a one-line addition per route.
- **Expected improvement:** Repeat visits and any CDN layer can skip the API entirely for the TTL
  window, reducing both API and database load for the public surface with the highest visitor count.

### PERF-312 — No response compression — **HIGH**

- **Location:** `apps/api/src/main.ts:26-27` — `app.use(helmet()); app.use(cookieParser());` — no
  `compression()` (or any gzip/brotli middleware) registered anywhere; confirmed `compression` isn't
  even a dependency in `apps/api/package.json`.
- **Current behavior:** Every JSON response is sent uncompressed. Observed directly in this session's
  e2e run logs: `GET /admin/roles` → 24,499 bytes, `GET /admin/bookings` → 10,850 bytes,
  `GET /tests/attempts/:id` → up to ~5,000 bytes, all uncompressed over the wire.
- **Performance impact:** Applies to literally every response from the API, not one specific route —
  the broadest-reaching finding in this report by surface area. JSON compresses exceptionally well
  (highly repetitive key names and structure).
- **Recommended solution:** `app.use(compression())` in `main.ts`, immediately after `helmet()`. One
  line. (Optionally exclude the `/payments/callback`/webhook-style routes if a future provider ever
  sends non-JSON bodies needing raw passthrough, but nothing here requires that today.)
- **Implementation complexity:** Trivial — one middleware line plus one new dependency
  (`compression`, and its `@types/compression` dev dependency).
- **Expected improvement:** Gzip/Brotli on JSON typically achieves 70-90% size reduction; directly
  cuts response transfer time, especially over mobile/high-latency connections, at the cost of a
  small amount of CPU per request (real but usually negligible next to the transfer-time savings for
  API-sized payloads). The single best effort-to-impact ratio in this entire report.

### PERF-313 — `docker-compose.yml` sets no resource limits on any service — **LOW**

- **Location:** `docker-compose.yml` — `postgres`/`redis`/`minio` services have no `deploy.resources`
  (or legacy `mem_limit`/`cpus`) constraints; no `shm_size` override for Postgres (default 64MB
  shared memory can bottleneck larger sorts/hash joins under load).
- **Current behavior:** This is the only compose file in the repository (no separate
  production-oriented compose/Dockerfile found) — whatever governs resource allocation in an actual
  deployed environment isn't visible in this repo.
- **Performance impact:** Low confidence/priority precisely because this repo doesn't show what (if
  anything) stands in for this file in production — flagged so it's checked at deploy time rather
  than asserted as a live problem.
- **Recommended solution:** If this compose file (or one derived from it) is what actually runs in
  production, add explicit memory/CPU limits sized to the host, and consider `shm_size: 256m`+ for
  Postgres if query plans ever show hash-join/sort spilling to disk.
- **Implementation complexity:** Trivial (compose file edit) once the target host's actual resource
  budget is known.
- **Expected improvement:** Prevents one container from starving the others under load; not
  applicable if a different, unseen configuration governs production.

---

## Summary and proposed priority order

| ID | Severity | Area | One-line fix effort |
|---|---|---|---|
| PERF-312 | High | Infra | Trivial — one middleware line |
| PERF-302 | High | Database | Trivial — one index |
| PERF-301 | High | Database | Medium — extension + index, explains LOAD-001 |
| PERF-310 | High | Caching | Medium — new cache helper + per-resource TTL decisions |
| PERF-303 | Medium-High | Database | Trivial — one index |
| PERF-305 | Medium-High | Database | Low-Medium — batch a lookup, parallelize an upsert loop |
| PERF-306 | Medium-High | Backend | Low — sequential loop to `Promise.all` |
| PERF-304 | Medium | Database | Trivial — one index |
| PERF-309 | Medium | Backend | Medium — needs a product decision on async-failure UX |
| PERF-307 | Low-Medium | Database | Low-Medium — bounded concurrency in a cron job |
| PERF-308 | Low-Medium | Infra | Trivial — connection-string param, needs a capacity decision |
| PERF-311 | Low-Medium | Caching | Low, once PERF-310's staleness decisions exist |
| PERF-313 | Low | Infra | Trivial, if this compose file governs production |

**Recommended order if approved:** PERF-312 (compression) and PERF-302/303/304 (missing indexes)
first — all trivial, independent, zero behavioral risk. PERF-301 next (explains the one inherited,
previously-open finding this pass could root-cause). PERF-306 (matching parallelization) before
PERF-305/307 (payout/reconciliation loops) since it's the only one on a user-facing request path.
PERF-310/311 (caching) last among the "do it" items — highest ceiling but needs real per-resource
staleness decisions, not just code. PERF-308/309/313 need an operational or product decision this
audit can't make alone, so they're "decide, then implement" rather than "implement."

No code was modified to produce this report. Awaiting approval before implementing any of the above.
