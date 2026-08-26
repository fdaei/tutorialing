# Phase 3 — Batch 2 performance and scalability results

Date: 2026-08-26. Baseline: `459ed1d` (the historical Phase 3 source report was
verified and committed unchanged immediately before this batch). Batch 2 changes are intentionally
left uncommitted for review. Batch 3 has not started.

## Selection and ranking

The historical hypotheses were checked against current code before selection. In particular,
PERF-304's two real callers do not share the same sort, and PERF-305's per-item upsert is insert-only
in practice. "Measured" below means this local seeded PostgreSQL environment; it has only 28 users,
so absolute timings are not production-representative.

| Rank | ID | Severity | Affected path | Actual root cause and impact | DB impact / expected benefit | Risk / complexity / dependency | Batch 2 |
|---:|---|---|---|---|---|---|---|
| 1 | PERF-305 | MEDIUM-HIGH | `PayoutsService.approvePayout()` | A transferred batch did one teacher lookup and one insert-only upsert per item inside one transaction. This is back-office, but increases transfer latency and transaction duration linearly. | Problem segment was 2N statements; set-based lookup and insert reduce it to 2. | Low-Medium / Low-Medium; preserve idempotency and missing-teacher failure. | **YES — FIX** |
| 2 | PERF-304 | MEDIUM | `AdminRepository.getUsers()`, `SearchService.users()` | No chronological sort index. Contrary to the report, Admin uses `createdAt`; Search uses `updatedAt` and neither default page filters by status. | Removes full sort/table traversal at production scale; two additive B-tree indexes. | Low / Low; index write/storage cost. | **YES — FIX** |
| 3 | PERF-314 | LOW-MEDIUM | Prisma includes across admin/auth/booking/payment reads | Current Prisma query strategy emits a fixed query per included relation, not one per root row. This is expected batching, not automatically N+1. | A JOIN might reduce round trips but can multiply rows and increase memory/serialization. | Medium / Medium-High; installed client requires the `relationJoins` preview feature. | **YES — ACCEPT, NO CODE** |
| 4 | PERF-308 | LOW-MEDIUM | Prisma datasource/deployment | No explicit pool limit, but the repository contains no production API replica count, DB connection budget, or PgBouncer topology. | Prevents exhaustion only if sized from real deployment data; arbitrary values can reduce throughput or still overload PostgreSQL. | High operational risk / Low code; depends on deployment facts. | **YES — DOCUMENT, NO CODE** |
| 5 | PERF-307 | LOW-MEDIUM | Two payment reconciliation sweeps | Work is mainly bounded external Zarinpal calls, followed conditionally by SQL. Sequential execution preserves provider pressure and deterministic failure isolation. No backlog/provider-latency evidence exists. | Concurrency would not remove calls and could burst the provider/DB. | Medium / Medium; depends on provider limits and backlog SLO. | NO |
| 6 | PERF-309 | MEDIUM | OTP request/SMS provider | Synchronous external Kavenegar call is the intentional fail-closed delivery contract. Backgrounding changes the API from confirmed acceptance to eventual delivery. | Removes provider latency from HTTP only by moving failure handling elsewhere. | High product/operational risk / Medium; needs pending-state/retry UX decision. | NO |
| 7 | PERF-311 | LOW-MEDIUM | Public GET controllers | No client/CDN caching headers, but freshness policy and deployed CDN are unspecified. | Could eliminate repeat requests; risks stale public content. | Medium / Low; depends on cache policy. | NO |
| 8 | PERF-310 | Reclassified CACHE OPTIONAL | Public read paths | Underlying expensive query defects are fixed; remaining candidates are already cheap/bounded. Redis availability alone is not evidence. | Possible DB offload under measured production traffic, not a current correctness/performance requirement. | Medium / Medium; invalidation/cardinality/security risks. | NO |
| 9 | PERF-313 | LOW | Development `docker-compose.yml` | Compose contains infrastructure services only and is not evidence of production resource scheduling. | Resource limits matter operationally but cannot be safely derived here. | High misconfiguration risk / Low; depends on production platform. | NO |

## PERF-304 — User listing sort indexes (fixed)

### Actual query shapes

- `AdminRepository.getUsers()` orders every page by `createdAt DESC`; status is optional.
- `SearchService.users()` orders every page by `updatedAt DESC`; its default page has no status
  filter.
- Therefore the historical `[status, updatedAt]` recommendation does not cover either unfiltered
  default path and does not cover Admin's actual sort.

### Before evidence

Against 28 local users, all three representative plans were `Seq Scan -> Sort`:

- Admin default: sort by `createdAt DESC`.
- Search default: sort by `updatedAt DESC`.
- Admin active-only: filter `status = ACTIVE`, then sort by `createdAt DESC`.

Local execution times were 0.147 ms, 0.067 ms, and 0.068 ms respectively. Those tiny numbers prove
only the query shape; they are not a reliable production benchmark.

### Implementation

- `@@index([createdAt])`
- `@@index([updatedAt])`
- additive migration `20260826103000_add_user_listing_sort_indexes`

The generated SQL was manually inspected. It contains exactly two `CREATE INDEX` statements, no
schema drift and no destructive SQL. The migration is applied locally; Prisma reports all 15
migrations applied and the schema up to date.

### After evidence

With `enable_seqscan=off` to overcome the rational tiny-table planner choice:

- Admin default: `Index Scan Backward using User_createdAt_idx`.
- Search default: `Index Scan Backward using User_updatedAt_idx`.
- Admin active-only: `Index Scan Backward using User_createdAt_idx`, applying status as a filter.

This is a verified access-path improvement. Production latency improvement is expected but **not
reliably measurable in the current environment** because the table has only 28 rows. On a large,
write-active `User` table, deployment should use controlled `CREATE INDEX CONCURRENTLY` operations;
plain Prisma migration DDL takes a write-blocking lock while each index is built.

## PERF-305 — Set-based payout transfer writes (fixed)

### Actual root cause

For each payout item, the old transaction performed:

1. one `Teacher.findUniqueOrThrow()` SQL lookup;
2. one `WalletEntry.upsert()` SQL statement.

The teacher `SELECT` did not itself lock every teacher row as the historical report implied, but
2N sequential round trips extended the transaction containing the earning and payout updates. The
upsert had `update: {}` and its result was unused, so its real contract was "insert if this unique
idempotency key is absent."

### Before/after evidence

For the regression case with 12 payout items belonging to three teachers:

| Segment | Before | After |
|---|---:|---:|
| Teacher resolution | 12 | 1 batched `findMany` |
| Wallet debit writes | 12 insert-only upserts | 1 `createMany(skipDuplicates)` |
| Total affected statements/delegate operations | **24** | **2** |

This is a deterministic query-count reduction derived from the exact delegate calls and pinned by
unit tests. Wall-clock latency is **not reliably measurable in the current environment**: the seeded
database has one payout item, and fabricating a production-sized financial batch solely for a
benchmark would add more risk than evidence.

### Correctness and tradeoffs

- Unique `idempotencyKey = payout-debit:<itemId>` remains the replay boundary.
- `skipDuplicates` is equivalent to the previous `upsert({update:{}})` behavior.
- Missing historical teacher references still fail before any debit insert; the exceptional path
  deliberately invokes `findUniqueOrThrow()` for the missing id to retain fail-fast semantics.
- No concurrency was introduced. Query work was eliminated/set-based, so DB connection pressure
  decreases rather than increases.
- Three regression tests cover batching, unique idempotency keys, and missing-teacher failure.

## PERF-314 — Prisma to-many relation loading (accepted; no code)

The installed Prisma client is 6.19.3. The generated client gates `relationLoadStrategy` behind the
`relationJoins` preview feature; the current schema enables no preview features, and a live call with
`relationLoadStrategy: 'join'` was rejected as an unknown argument.

Measured current production-query shapes (transaction BEGIN/COMMIT excluded):

| Query | Root rows | SQL statements | JSON bytes in seeded DB |
|---|---:|---:|---:|
| Admin bookings (`take: 200`, four relations) | 13 | 5 | 18,417 |
| Admin tickets (`take: 200`, user + replies) | 7 | 3 | 7,908 |
| Admin roles (`take: 300`, nested permissions) | 34 | 4 | 26,951 |
| Admin payments (`take: 200`, refunds + reconciliations + user) | 12 | 4 | 7,878 |
| One admin user detail (four to-many relations in the measured shape) | 1 | 6 | bounded |

These counts are constant per included relation, not proportional to the number of root rows. For
example, 34 roles and 121 role-permission rows are loaded in four batched statements; an equivalent
naive join already produces 144 rows locally and repeats root/user columns. Queries with two
independent to-many relations can multiply both child sets, increasing transfer, decoding, and
memory even while reducing statement count.

Conclusion: **ACCEPT / NO ACTION**. There is no demonstrated N+1 defect, no production latency
evidence, and enabling a preview feature globally or forcing joins would be an architectural change
with row-explosion risk. Reconsider per query only if production tracing identifies a specific
round-trip-bound include; benchmark query strategy, rows transferred, heap use, and serialization
for that exact query first. Explicit batching remains preferable for hot paths like PERF-306.

## PERF-308 — Connection pool capacity (documented; no code)

Observed locally: PostgreSQL `max_connections = 100`, three superuser-reserved connections, and
eight connections during inspection. The repository runs one persistent NestJS process in local
documentation, has no API service in Compose, no production replica count, no PgBouncer config, and
no production database connection budget. Prisma uses the datasource URL without explicit
`connection_limit`/`pool_timeout`.

No safe number can be selected. Production must satisfy:

`app_instances × per_instance_pool + worker_pools + migration/admin/monitoring_reserve <= usable PostgreSQL connections`

where usable connections are `max_connections` minus PostgreSQL reserved slots and an explicit
operational emergency reserve. Required deployment inputs: maximum simultaneous API replicas,
whether schedulers share those processes, worker count, actual DB limit, PgBouncer mode/capacity,
peak request concurrency, transaction duration, and acceptable pool wait timeout. Until these are
known, PERF-308 is **CONFIG REQUIRED / NO CODE**, not a guessed application default.

## Findings investigated but intentionally unchanged

- **PERF-307:** two single-flight, bounded reconciliation workflows. Work classification is one SQL
  candidate query, N external Zarinpal calls, and conditional SQL/Redis work. No provider rate limit,
  sweep-duration metric, or backlog exists. Keep sequential failure isolation; add duration/backlog
  telemetry before considering bounded concurrency.
- **PERF-309:** external network latency dominates OTP, but the caller currently needs synchronous
  provider acceptance and receives 503 on rejection. Queueing would change correctness/failure UX;
  requires a product-approved pending/retry model.
- **PERF-311:** no header added without an approved freshness/CDN policy.
- **PERF-313:** local Compose is not the production scheduler; no limits guessed.

## PERF-310 cache reassessment after Batch 2

Local measurements are diagnostic only, not production latency claims:

| Endpoint/data | Local latency | SQL | Read/write ratio | Staleness / TTL / invalidation | Key and auth scope | Classification |
|---|---:|---:|---|---|---|---|
| Teacher directory, unfiltered page 1 | 66.28 ms | 4 | Unknown; expected read-heavy | 30–60s could be acceptable; invalidate approval/price/profile changes | `teachers:list:v1:page1:<sort>`, public only | CACHE OPTIONAL |
| Teacher profile | Not re-measured | multiple bounded queries | Unknown; expected read-heavy | 60–120s; invalidate teacher/profile/package/review publication | `teacher:profile:<slug>`, public | CACHE OPTIONAL |
| Languages | 3.79 ms | 1 | Expected very high read/rare write | 5–10 min; invalidate admin language mutation | `languages:active:v1`, public | CACHE OPTIONAL, low absolute cost |
| Public settings | 1.85 ms | 1 | Expected read-heavy/rare write | 60–300s; invalidate setting update | `settings:public:v1`, public | CACHE OPTIONAL, low priority |
| Published CMS page | 1.70 ms | 1 | Unknown; expected read-heavy | 60–300s; invalidate publish/update | `page:<slug>`, public | CACHE OPTIONAL |
| Payments/wallet/payouts/roles/permissions/user-specific data | Not applicable | varies | sensitive | No acceptable stale window | authenticated/user-scoped | **DO NOT CACHE** |
| Availability/matching slots | Not applicable | batched after PERF-306 | volatile | No acceptable stale window | booking-state-sensitive | **DO NOT CACHE** |

No candidate rises to CACHE REQUIRED. Measured production traffic, hit-rate potential, and latency
SLOs—not Redis's existence—must justify any later cache.

## Final gate and staff-engineer review

- API: **284/284** tests passed (up from 281; three PERF-305 regressions added).
- Web: **24/24** passed.
- Authorization: **5/5** passed.
- Architecture: **4/4** passed.
- Targeted payout/reconciliation/money suites: **29/29** passed.
- Typecheck, lint, Prisma validation, and production build: passed.
- E2E: **5/6**; sole failure is the identical pre-existing TEST-001 signature at
  `platform.e2e-spec.ts:245` (`expected 201, got 401`).
- Migration status: 15 migrations applied; database schema up to date.

The batch reduces actual SQL work rather than moving it: PERF-305 does not add concurrency, queues,
cache, or memory-heavy joins. PERF-304 adds two small write/storage costs for verified read paths.
Business behavior, transaction boundaries, authorization, ownership, JWT, and Phase 2 policies are
unchanged. No new finding was discovered.

## Recommended Batch 3 (not started)

1. Add reconciliation duration/backlog/provider-call telemetry, then reassess PERF-307 with actual
   provider limits and missed-SLO evidence.
2. Resolve PERF-309 only after product chooses synchronous failure versus queued/pending OTP UX.
3. Revisit PERF-308 with the real production topology and connection budget.
4. Consider PERF-310/311 only if production traffic proves a CACHE OPTIONAL candidate worthwhile.
5. Close or configure PERF-313 in the actual deployment repository/platform, not local Compose.
