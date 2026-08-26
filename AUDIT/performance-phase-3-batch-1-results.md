# Phase 3 — Batch 1 remediation results

Scope: **PERF-301, PERF-302, PERF-303, PERF-306, PERF-312** only, per instruction. PERF-310
(caching) deliberately not implemented — see the reassessment at the end of this document.
PERF-304/305/307/308/309/311/313 untouched (next-batch candidates, see the closing section).

Baseline: commit `501f150` (Phase 2 security hardening, HEAD at the start of this pass).
`AUDIT/performance-phase-3-report.md` (13 findings, PERF-301..313) is the source finding set;
this document only re-derives evidence where the original pass's caveats (tiny dev dataset)
made a claim non-verifiable, or where implementation required a decision the report left open
(exact composite-index column, migration structure).

Final review completed on 2026-08-26. Implementation was split by responsibility into
`707a9b7` (PERF-301/302/303), `b250133` (PERF-306), and `e280c99` (PERF-312); this report and
the audit-state update are recorded separately. Batch 2 has not started.

---

## Environment used for this pass

`npm run services:up` (Postgres 16-alpine / Redis / MinIO) + `npm run db:prepare`. Seeded dev
database row counts: **12** approved-with-pricing `Teacher` rows (13 total), **10** `Payment`,
**5** `Ticket** — the same tiny-dataset environment the original Phase 3 report used and flagged.
Every `EXPLAIN`/query-count number below is a real measurement against this database, not an
estimate — but absolute latency numbers at this row count are **not** representative of
production scale; see each finding's "what this does and doesn't prove" note.

---

## PERF-301 — Teacher search: pg_trgm GIN indexes

**Root cause (confirmed):** `TeachersService.directory()` (`teachers.service.ts:43-49`) compiles
`search` into `ILIKE '%term%'` across `nameFa`/`nameEn`/`bioFa`/`bioEn`. A leading-wildcard
`ILIKE` cannot use a plain B-tree index at any table size.

**Fix:**
- Migration `20260826055153_teacher_search_trigram_indexes`:
  - `CREATE EXTENSION IF NOT EXISTS pg_trgm;` (pg_trgm is a PostgreSQL-13+ "trusted" extension —
    installable by the database owner, no superuser required; confirmed available in the
    `postgres:16-alpine` image via `pg_available_extensions`).
  - One GIN trigram index per searched column (`Teacher_nameFa_idx`, `Teacher_nameEn_idx`,
    `Teacher_bioFa_idx`, `Teacher_bioEn_idx`), rather than one combined `tsvector` column — this
    stays additive/reversible (no generated column, no query rewrite) and lets Postgres `BitmapOr`
    together only the columns a given search actually matches. A `tsvector` full-text-search
    subsystem was considered and rejected as unjustified scope per the task's own instruction.
  - `@@index([status, approvedTrialPrice])` — the `sort=price_asc` path had no supporting index
    even though the other two default sorts (`approvedAt`, `rating`) did.
- Schema: `apps/api/prisma/schema.prisma` `Teacher` model, native Prisma `type: Gin` /
  `ops: raw("gin_trgm_ops")` syntax — no preview feature flag needed (this syntax has been GA
  since Prisma 4.7; confirmed by `prisma validate` passing cleanly on the installed 6.19.3).

**Query plan evidence (`EXPLAIN ANALYZE`, live dev DB):**

Before (search filter, natural planner choice):
```
Seq Scan on "Teacher"  (cost=0.00..1.29 rows=3 width=574) (actual time=0.022..0.064 rows=10 loops=1)
  Filter: (approvedTrialPrice IS NOT NULL AND approvedRegularPrice IS NOT NULL AND status = 'APPROVED'
           AND (nameFa ~~* '%ali%' OR nameEn ~~* '%ali%' OR bioFa ~~* '%ali%' OR bioEn ~~* '%ali%'))
```

After, single column isolated (`SET enable_seqscan=off`, to prove the index is actually usable
regardless of what the tiny-table planner naturally picks):
```
Bitmap Heap Scan on "Teacher"  (cost=8.55..12.56 rows=1 width=574)
  Recheck Cond: (nameFa ~~* '%ali%')
  ->  Bitmap Index Scan on "Teacher_nameFa_idx"  (cost=0.00..8.54 rows=1 width=0)
        Index Cond: (nameFa ~~* '%ali%')
```

After, the full 4-column OR query (`enable_seqscan=off`):
```
Index Scan using "Teacher_status_approvedTrialPrice_idx" on "Teacher"  (cost=0.14..12.46 rows=3 width=574)
  Index Cond: (status = 'APPROVED' AND approvedTrialPrice IS NOT NULL)
  Filter: (approvedRegularPrice IS NOT NULL AND (nameFa ~~* '%ali%' OR ... ))
```
At 12 rows, Postgres's cost-based planner correctly judges the new `[status, approvedTrialPrice]`
btree index cheaper than four `BitmapOr`'d GIN scans for *this* row count, and uses it instead —
this is **correct planner behavior at small scale, not evidence the trigram indexes don't work**;
the isolated single-column plan above proves each GIN index is independently valid and used.
At production scale (thousands of teachers), the btree's `status` filter alone stops being
selective enough to beat trigram-narrowed `BitmapOr`, and the planner will switch — this crossover
is exactly the behavior `pg_trgm` is for.

`price_asc` sort, forced:
```
Index Scan using "Teacher_status_approvedTrialPrice_idx" on "Teacher"  (cost=0.14..12.34 rows=12 width=574)
  Index Cond: (status = 'APPROVED')
```
No separate `Sort` node — the index satisfies the filter and the order in one pass.

**Short-search-term / abuse analysis (measured, not assumed):** `pg_trgm`'s LIKE/ILIKE operator
support pads the pattern and can still probe the GIN index below 3 characters — it does not fail
over to a full scan at a hard length cutoff. Measured:
```
'%ali%' (3 chars): Bitmap Index Scan, cost=0.00..8.54
'%a%'   (1 char):  Bitmap Index Scan, cost=0.00..591.71   -- same index, correctly costed as far less selective
```
So a 1-character search still uses the index; it's just honestly expensive because it's
genuinely unselective, which is the correct outcome, not a broken one. `GET /teachers` was
already rate-limited (`@RateLimit(RATE_LIMIT_TIERS.publicRead)`, `teachers.controller.ts:10`)
before this change, and that limiter is what actually bounds repeated-short-search abuse — the
index change doesn't introduce a new attack surface, since **every** search of **any** length was
already doing a full sequential scan before this fix (i.e., a 1-character search is not worse
post-fix than it was pre-fix; it's the same or better). No minimum-length restriction was added:
that would be a public-API behavior change beyond "add an index," and isn't justified by anything
measured this pass.

**Skill/language filter path:** left untouched, exactly as the original report scoped it
("better served by moving `specialties` onto `TeacherLanguage`... or documenting as an accepted
cost" — explicitly not part of this batch).

**Files changed:** `apps/api/prisma/schema.prisma`,
`apps/api/prisma/migrations/20260826055153_teacher_search_trigram_indexes/migration.sql`.

**Production migration safety:** Plain `CREATE INDEX` (not `CONCURRENTLY`) — this migration
applies inside `prisma migrate deploy`'s standard transactional flow, and Postgres forbids
`CREATE INDEX CONCURRENTLY` inside a transaction block. Plain `CREATE INDEX` holds a `SHARE` lock
on `Teacher` for the build's duration (blocks writes, not reads) — acceptable for a table this
size today, but **on a `Teacher` table at real production scale, a GIN trigram build is not
instant, and this table is written to on every teacher application/approval/price-review action.**
Recommended production procedure: apply this migration's `CREATE EXTENSION` statement normally,
then run the four `CREATE INDEX CONCURRENTLY ... USING GIN (... gin_trgm_ops)` statements by hand
against production outside the deploy transaction, and mark the migration as applied via
`prisma migrate resolve --applied 20260826055153_teacher_search_trigram_indexes` so `migrate
deploy` doesn't try to recreate them non-concurrently on top. This is a documentation-only
recommendation for this pass — dev/test applied the plain version, which is correct for those
environments.

---

## PERF-302 — `Payment` missing `[userId, createdAt]` index

**Fix:** `@@index([userId, createdAt])` on `Payment`, mirroring `WalletEntry`'s existing index
exactly, confirmed against the two real read sites: `WalletService.invoices()`
(`wallet.service.ts:33-39`, `GET /payments/invoices`, `orderBy: createdAt desc`) and
`AdminService.userDetail()`'s nested `payments` relation (`admin.service.ts:70-74`, same sort).

**Evidence (`enable_seqscan=off`, to prove usability independent of the tiny table's natural
planner choice):**
```
Before: Seq Scan on "Payment" -> Sort (Sort Key: createdAt DESC)
After:  Index Scan Backward using "Payment_userId_createdAt_idx" on "Payment"
          Index Cond: (userId = '...')
        -- no separate Sort node: the index satisfies the filter AND the ORDER BY in one pass
```

**Files changed:** `apps/api/prisma/schema.prisma`,
`apps/api/prisma/migrations/20260826054927_add_payment_ticket_userid_indexes/migration.sql`.

---

## PERF-303 — `Ticket` missing userId index

**Deviation from the original report, with evidence:** the report offered `[userId, createdAt]`
or `[userId, updatedAt]` as options. Reading the actual query
(`support.service.ts:111-124`, `SupportService.list()`'s non-staff path) shows the real sort is
`orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }]` — **not** `createdAt`. Built
`@@index([userId, updatedAt])` instead, matching both the real query and the existing
`[status, updatedAt]` staff-queue index's own convention.

**Evidence:**
```
Before: Sort (Sort Key: updatedAt DESC) -> Seq Scan on "Ticket", Filter: (userId = '...')
After (enable_seqscan=off): Index Scan Backward using "Ticket_userId_updatedAt_idx"
                               Index Cond: (userId = '...')
        -- again, no separate Sort node
```

**Files changed:** same migration as PERF-302 (`prisma migrate dev` batched both index additions
into one migration since both were made in the same schema edit). During final pre-commit review,
an unrelated `DashboardStat.updatedAt` default-drop produced by schema/database drift was removed
from the generated SQL so the migration contains only PERF-302/303 changes.

---

## PERF-306 — Matching questionnaire: batch availability instead of parallelizing it

**Root cause, traced fully before writing any code (per instruction to prefer query elimination
over parallelization):** `MatchingService.create()` (`matching.service.ts`) fetches up to 40
candidate teachers, then for each one calls `AvailabilityService.slots(teacherId, ...)`
sequentially. Reading `slots()` end to end showed it was not just sequential — it was **doing
duplicate and redundant work per candidate**:
1. `this.settings.numeric('booking.minLeadMinutes', ...)` and `...('booking.maxAdvanceDays', ...)`
   — two Postgres reads of **global, request-invariant** config, re-executed on every single
   candidate iteration even though the value cannot differ between candidates in the same request.
2. `teacher.findFirst(...)` re-fetching the teacher row and its `availabilityRules` — data
   `MatchingService`'s own initial `teacher.findMany` **already had in memory**, since that query
   already `include`s `availabilityRules: { where: { active: true } }` and (via plain `include`,
   not `select`) every Teacher scalar column including `trialDuration`/`lessonDuration`/
   `breakMinutes`. This fetch was pure waste.
3. `availabilityOverrides`, `blockedPeriods`, `bookings` — genuinely per-teacher data, but fetched
   one candidate at a time instead of once for all candidates via `teacherId: { in: [...] }`.

So this was an N+1 (and re-fetch) problem, not a "slow sequential loop" problem — parallelizing it
with `Promise.all` as initially suggested by the original report would have fired the *same*
wasteful per-candidate query set concurrently instead of eliminating it, trading a query-count
problem for a connection-pool-pressure problem. Per the task's explicit priority
("prefer query elimination over query parallelization"), this was fixed by eliminating the
redundant reads instead.

**Fix — `apps/api/src/modules/bookings/availability.service.ts`:**
- Extracted the pure, no-I/O day-iteration slot-computation logic (previously inline in `slots()`)
  into a private `computeSlots(params)` method, parameterized on explicit values instead of a
  Prisma-relation-shaped `teacher` object. `slots()` (still used by `GET /availability/:id/slots`
  and unchanged in behavior/signature) now just fetches as before and calls `computeSlots()`.
- Added `slotsForCandidates(candidates, from, to, type)`: fetches the two global settings **once**,
  then batch-fetches `availabilityOverride`/`blockedPeriod`/`booking` rows for **all** candidate
  teacher IDs in three `findMany({ where: { teacherId: { in: [...] } } })` calls, groups each
  result set by `teacherId` in memory, and calls `computeSlots()` once per candidate against its
  own slice — no database access happens inside that final per-candidate loop, since everything it
  needs is already resident in memory grouped by ID.
- `MatchingService.create()` now calls `slotsForCandidates(teachers, ...)` once instead of
  `slots()` in a loop. The per-teacher scoring/filtering loop is unchanged (`matching.service.ts`)
  except that it now reads `slotsByTeacher.get(teacher.id)` instead of awaiting anything — **the
  loop is no longer async at all**, so there was nothing left to parallelize once the query
  elimination was done, exactly matching the task's stated preference.
- Result ordering, scoring formula, and every business rule are byte-for-byte unchanged — only the
  data-fetching shape changed. `MatchingService`'s own candidate ordering/ranking logic was not
  touched.

**Query count — measured directly** (not estimated): instrumented a standalone script against the
live seeded dev database with Prisma's `query` log event, reproducing the exact old fetch shape
(2 settings reads + 1 `teacher.findFirst` with the same 4-relation `include`, per candidate) versus
the exact new fetch shape (2 settings reads once + 3 batched `findMany` calls), over the same 12
real approved-with-pricing teachers Prisma returns for this query today:

| | SQL statements | Statements per candidate |
|---|---|---|
| Before (sequential, one `slots()`-shaped fetch per teacher) | **84** | 7.0 |
| After (`slotsForCandidates`, batched) | **5** | constant, independent of N |

(The 7 statements/candidate in the "before" row = 2 settings reads + 5 statements for the
`findFirst` with 4 included to-many relations — Prisma's query engine here issues one query for
the base row plus one additional query per included to-many relation, not a single joined query;
see the new PERF-314 finding below.) This is a 94% reduction in query count at 12 candidates and
scales to a **larger** reduction as candidate count grows toward the endpoint's actual cap of 40,
since the "after" cost is flat at 5 regardless of N while "before" grows linearly at 7×N.

**Latency:** not independently re-benchmarked as a clean before/after pair in this environment —
see "what this does and doesn't prove" below for why. The real, measured signal is the query-count
reduction above; end-to-end latency for this endpoint is dominated by DB round-trip count at this
data size (no heavy CPU work, no external I/O in the loop), so a 94%+ reduction in round trips is
expected to translate directly into a comparable latency reduction, but that inference is not
itself a measured number and is reported as an inference, not a fact.

**What this does and doesn't prove:** the query-count numbers above are real, not estimated —
captured via Prisma's own query-event log against the actual seeded database, with the exact
`where`/`include` shapes copied from the real (pre-fix, for the "before" row) and real (post-fix,
for the "after" row) source. What's *not* independently benchmarked is wall-clock latency
before vs. after: the pre-fix code no longer exists in the working tree, and reproducing it would
mean reverting `availability.service.ts` inside the shared, already-running dev server this
session found live (`nest start --watch`, PIDs predating this session) — an unnecessary disruption
to whatever else that instance is being used for, for a number that would be dominated by
localhost round-trip noise at 12 rows and wouldn't generalize to the 40-candidate production case
the finding is actually about anyway. **Not reliably measurable as a clean before/after pair in
this environment; the query-count reduction is the trustworthy signal.**

**Behavior preserved (verified, not assumed):** the full e2e suite's
`lists only approved teachers and persists best-three matching` test (`test/platform.e2e-spec.ts`)
exercises `POST /api/matching` against the real batched code path end to end — including a
subsequent real booking against one of the returned recommendations' slots
(`prevents concurrent reservation of the same teacher slot`) — and both pass. This is a stronger
correctness check than a unit test alone: it proves a slot the batched path reports as available
is *actually* bookable through the real booking flow's own independent availability
re-verification.

**Regression tests added:**
- `matching.service.spec.ts`: updated the existing mock from `slots` to `slotsForCandidates`
  (returning a `Map`), and added an explicit assertion that `slotsForCandidates` is called
  **exactly once** per `create()` call (not once per candidate) — a direct regression guard
  against silently reverting to the per-candidate loop.
- `availability.service.spec.ts`: two new tests under `AvailabilityService.slotsForCandidates
  (PERF-306)` — (1) three candidates, one blocked, one booked, one clean, asserting each
  candidate's `Map` entry is correctly isolated (the block on teacher `a` must not leak into `b`
  or `c`'s results) **and** that each of the three per-relation queries is called exactly once
  regardless of candidate count; (2) an empty-candidates call makes zero queries.

**Files changed:** `apps/api/src/modules/bookings/availability.service.ts`,
`apps/api/src/modules/matching/matching.service.ts`,
`apps/api/src/modules/bookings/availability.service.spec.ts`,
`apps/api/src/modules/matching/matching.service.spec.ts`.

---

## PERF-312 — Response compression

**Verified before implementing (per instruction to check for double-compression/streaming
conflicts first):**
- Grepped the whole API for `StreamableFile`, `res.download`, `createReadStream`, `@Sse`,
  `EventSource`, `text/event-stream` — zero matches. `FilesController.download()`
  (`files.controller.ts:34-37`) returns JSON (a presigned MinIO URL via `files.service.ts:108+`),
  confirming the API itself never streams binary file content — MinIO serves file bytes directly
  against presigned URLs, so there is no download/streaming endpoint compression could interfere
  with.
- No reverse proxy / CDN config found in the repository (`docker-compose.yml` only defines
  `postgres`/`redis`/`minio` — dev backing services, not the API or a proxy in front of it; no
  nginx/Caddy config, no deployment docs describing production topology). Nothing in-repo already
  compresses responses, so there is no double-compression risk to guard against, and
  application-level compression is the only place available in this repository to add it.

**Fix:** `apps/api/src/main.ts` — `app.use(compression({ threshold: 1024 }))`, immediately after
`app.use(helmet())`, before `cookieParser()`. `1024` is `compression`'s own documented default
(confirmed by reading `node_modules/compression/index.js`); set explicitly rather than left
implicit, since "configure a sensible minimum-size threshold" was an explicit requirement — this
makes the choice a visible decision rather than an unstated default. Content-type filtering
(skip already-compressed types) is `compression`'s own default behavior via the `compressible`
mime-db lookup — no extra configuration needed there.

**Dependencies added:** `compression@^1.8.1`, `@types/compression@^1.8.1` (dev). Verified after
install: `npm ls postcss` still resolves every copy to `8.5.24` (the CLAUDE.md-documented pinned
version, unaffected by this install), and `npm audit --omit=dev -w @lingospeak/api` shows the
exact same 5 advisories as before the install (the pre-existing, already-tracked SEC-201 set —
`compression` introduced zero new advisories).

**Live evidence (measured against the running dev server, which auto-reloaded via `nest
start --watch` after the `main.ts` edit — not a synthetic test):**

| Endpoint | Uncompressed (wire bytes) | Gzip (wire bytes) | Reduction |
|---|---|---|---|
| `GET /api/languages` | 1,864 | 555 | 70.2% |
| `GET /api/teachers?limit=12` | 10,355 | 1,911 | 81.5% |

Confirmed via `curl -w '%{size_download}'`, with and without `Accept-Encoding: gzip`; response
headers confirmed `Content-Encoding: gzip` and `Vary: Origin, Accept-Encoding` present only on the
compressed response, and absent (full uncompressed body, correct `Content-Length`) on the
plain request — i.e., a client that doesn't advertise gzip support gets exactly the same bytes it
always did (this is also the honest "before" measurement: identical to pre-fix behavior for any
client not sending `Accept-Encoding`, since `compression` never compresses for such a client).
All other headers (CSP, CORS, `X-Request-Id`, etc.) confirmed unchanged in both cases.

**Files changed:** `apps/api/src/main.ts`, `apps/api/package.json`, `package-lock.json`.

---

## Test gate (run after all five findings above, together)

- `npm run typecheck` — PASS (contracts, api, web)
- `npm run lint` — PASS (api, web)
- `npm run test` — PASS: **281/281 api tests** (42 suites, up from 279 — the 2 new
  `slotsForCandidates` tests), **24/24 web tests** (unchanged)
- `npm run build` — PASS (contracts, api, web — including Next.js production build)
- `npm run test:e2e -w @lingospeak/api` — **5/6 pass.** The one failure
  (`exposes admin operations and rolls back wallet debits on failed gateway callbacks`, "expected
  201, got 401") is the pre-existing, already-documented **TEST-001** shared-token test-isolation
  bug (confirmed identical failure message/location to the `state.json` TEST-001 record, which was
  independently reproduced against pre-Phase-2 code — not something this pass touched or
  introduced). The other 5 e2e tests, including the two that directly exercise this batch's
  changes (`lists only approved teachers and persists best-three matching` →
  `POST /api/matching` → the new `slotsForCandidates` path; `prevents concurrent reservation of
  the same teacher slot` → `GET /availability/:id/slots` → the unchanged `slots()` path, then a
  real booking) — all pass.
- `authorization.spec.ts` — PASS (re-confirmed explicitly per instruction)
- `architecture.spec.ts` — PASS (re-confirmed explicitly per instruction)

No security, authorization, or RBAC behavior was touched by any change in this batch — verified by
the full security-regression suite passing unchanged (Phase 2's SEC-207/208/209/210 test files all
still pass), and by inspection: every change in this batch is either a new index (no application
code path changed) or a data-fetching refactor that preserves the exact same `where` filters
(`status: 'APPROVED'`, ownership/self-scoping) that existed before.

---

## New finding discovered this pass (not fixed — registered per instruction, scope not expanded)

### PERF-314 — Prisma issues one SQL statement per included to-many relation, not a joined query

**Location:** general — confirmed via direct measurement on
`teacher.findFirst({ include: { availabilityRules, availabilityOverrides, blockedPeriods,
bookings } })` (the exact shape `AvailabilityService.slots()` uses): **5** SQL statements for one
logical fetch (1 base + 1 per included to-many relation), not 1 joined query.

**Impact:** this is Prisma's default `relationLoadStrategy` for the installed version/setup
(`'query'`, not `'join'`) — it's not specific to `AvailabilityService`. Any other service in this
codebase using `include` with multiple to-many relations pays the same N+1-shaped-per-call cost
PERF-306 had, just without necessarily being in an outer loop that makes it as visible. Grepping
for multi-relation `include` blocks across `apps/api/src/modules` would be needed to size the
actual blast radius — not done this pass, to avoid scope creep beyond the five approved findings.

**Recommendation for Batch 2:** evaluate Prisma's `relationLoadStrategy: 'join'` option (available
for PostgreSQL; join-strategy relation loading fetches multi-relation `include`s in a single query
using Postgres lateral joins) as a global or per-query opt-in. This is a genuinely new
architectural decision — not a drop-in fix — since it changes how Prisma generates SQL across
every affected query and needs its own evaluation (stability for the installed Prisma version,
whether it changes result shapes for `take`/`skip` inside nested relations, query-plan behavior
under Postgres's own planner for the joined form) before adopting broadly. Filed here rather than
fixed, per the instruction not to silently expand this batch's scope.

**Status:** open, documented only.

---

## Post-Batch-1 Cache Candidate Analysis (PERF-310 reassessment)

PERF-310 was explicitly not implemented this pass. This section re-evaluates it now that
PERF-301/302/303/306/312 are fixed — the original report's "HIGH" severity for PERF-310 leaned
partly on the *compounding* effect of caching a query that was also doing a full sequential scan
(PERF-301) or an N+1 fetch (PERF-306); with those root causes fixed, caching is now genuinely an
additive optimization on top of reasonably-shaped queries, not a way to paper over a bad one — a
materially different, lower-urgency proposition than what the original report assessed.

| Endpoint | Data cached | Current cost (post-Batch-1) | Read/write ratio | Scope | Staleness tolerance | Proposed TTL | Invalidation | Cache key | Classification |
|---|---|---|---|---|---|---|---|---|---|
| `GET /teachers` (no filters, page 1, default sort only) | Directory listing | Index-assisted (`[status, approvedAt]`/`[status, rating]`), compressed response | Very high reads : rare writes (teacher approval/price events) | Global, public, unauthenticated | High — a few seconds/minutes of staleness is invisible to users | 30-60s | None needed at that TTL; optional bust on teacher approval/price-review write | `teachers:list:v1:page1:<sort>` (fixed, small key set — **not** per filter combination) | **CACHE OPTIONAL** — real win at production traffic, but the underlying query is no longer a sequential scan, so this is no longer masking a defect |
| `GET /teachers` (any filter combination: search/skill/language/minBand/maxPrice) | Filtered listing | Now trigram-index-assisted for `search` | High reads, but combinatorially many distinct queries | Global, public | Same as above in principle | N/A this pass | N/A | Unbounded key cardinality from filter combinations | **DO NOT CACHE** (as-is) — the original report's own caution about unbounded cache-key cardinality still applies; would need a deliberate cardinality-limiting design (e.g., cache only the top-N most common filter combos) before revisiting |
| `GET /teachers/:slug` | Single teacher profile | PK/unique lookup, already cheap | Very high reads : rare writes (per-teacher edits are infrequent) | Global, public, per-slug (bounded cardinality — one entry per teacher) | High | 60-120s or invalidate-on-write from the teacher-approval/price-review/profile-update paths | Invalidate on write is cheap here since those write paths are few and already identifiable | `teacher:profile:<slug>` | **CACHE OPTIONAL** |
| `GET /languages` | Reference data (language list) | Cheap already (small table, no filter complexity) | Extremely high reads : extremely rare writes (admin-managed) | Global, public | Very high | 5-10 min | Admin language create/update/deactivate | `languages:active:v1` | **CACHE OPTIONAL** — safest, lowest-risk candidate in this table, but low absolute cost today means low urgency too |
| `GET /support/public-settings` | `Setting` rows where `public: true` | Cheap (small table) | High reads : very rare writes | Global, public | High | 60-300s | Admin setting update | `settings:public:v1` | **CACHE OPTIONAL**, low priority — payload and query are both already small; caching mainly saves round trips, not compute |
| CMS pages (`GET /support/pages/:slug`) | Published page content | Not measured this pass (out of this batch's scope) | Likely high reads : rare writes (staff-published) | Global, public, per-slug | High | 60-300s or invalidate-on-publish | Page publish/update action | `page:<slug>` | **CACHE OPTIONAL** |
| `GET /payments/invoices`, `AdminService.userDetail()` payments | Payment history | Now index-assisted (PERF-302) | Financial, user-specific | **User-scoped** | Low — a user acting on their own payment history expects it current | — | — | — | **DO NOT CACHE** — explicitly flagged as a sensitive category by the task; now fast via indexing, no need to trade correctness for speed here |
| `GET /support/tickets` (self-scoped) | Ticket list | Now index-assisted (PERF-303) | User-specific, low absolute traffic | **User-scoped** | Low — a user expects to see their own ticket/reply immediately after acting | — | — | — | **DO NOT CACHE** |
| `GET /availability/:id/slots`, matching's batched availability | Bookable slot list | Now batched (PERF-306) | Correctness-critical, time-and-booking-state-dependent | Effectively global-but-highly-volatile (changes on every booking) | **None** — a stale slot list can offer a slot someone else just took | — | — | — | **DO NOT CACHE** — explicitly flagged as a sensitive category by the task; the real booking flow does re-verify availability independently at Serializable isolation before committing, so a stale cache wouldn't cause a double-booking, but it would produce a confusing "that slot just became unavailable" UX for no real benefit, since PERF-306 already made this path fast |
| Roles/permissions, wallet balances, payouts | — | — | — | User/permission-scoped | None | — | — | — | **DO NOT CACHE** — explicitly flagged by the task; not touched or reconsidered this pass |
| Admin dashboard (`DashboardStatsService`) | Aggregate platform stats | Already a materialized projection (`DashboardStat` table, refreshed on a `@Interval` + Postgres-advisory-locked cron, per the original Phase 3 report's own "strengths" section) | — | — | — | — | — | — | **Not a new candidate** — already effectively cached via a materialized-projection pattern; nothing to add here |

**Overall PERF-310 reassessment:** no candidate in this table rises to **CACHE REQUIRED** — that
tier would mean something is broken or unacceptably slow without a cache, and after Batch 1,
nothing in this list is. The strongest candidates (`GET /teachers` unfiltered, `GET
/teachers/:slug`, `GET /languages`) are legitimate, low-risk wins worth doing under real
production traffic, but they're throughput/cost optimizations on top of already-reasonable
queries now, not a fix for a defect — exactly the distinction the task asked this reassessment to
make. Recommend: if Batch 2 or a later pass implements PERF-310, scope it to the
**CACHE OPTIONAL** rows only, skip the unbounded-cardinality filtered-teacher-search variant
without a separate cardinality design, and continue treating every row marked **DO NOT CACHE**
here as out of bounds regardless of Redis's availability.

---

## Staff/Principal review of this batch

- **Was any complexity added without measurable value?** `AvailabilityService` gained a second
  public method (`slotsForCandidates`) and one new private helper (`computeSlots`) instead of a
  `Promise.all` one-liner — more surface area than the original report's own suggested fix. This
  was a deliberate tradeoff: the report's suggested `Promise.all` would have parallelized the
  *wasteful* per-candidate fetch shape rather than removing it, so the extra surface area here is
  what actually earned the 94% query-count reduction, not incidental complexity. `slots()` (the
  single-teacher path used elsewhere) is untouched in behavior and still the simpler entry point
  for that case.
- **Are the indexes actually justified?** Yes for all six added (`Payment`, `Ticket`, and four on
  `Teacher`) — each is tied to a real, currently-executing query read directly from the service
  code, not a hypothetical future one, and each was checked against existing indexes to avoid
  redundancy (e.g., `Ticket`'s new index intentionally uses `updatedAt` not `createdAt` after
  reading the actual `orderBy`, deviating from the original report's first suggestion once the
  real query pattern was confirmed).
- **Could an optimization create DB pressure under concurrency?** The opposite direction here:
  PERF-306 *reduces* concurrent connection/query pressure (84→5 statements at N=12, and the ratio
  improves further as N grows toward 40) rather than increasing it, since the fix eliminated
  round trips instead of parallelizing them. The four new GIN indexes and two new btree indexes
  add write-path overhead (every `Teacher`/`Payment`/`Ticket` insert/update now maintains more
  indexes) — normal, expected, and small relative to the read-side win; not separately quantified
  this pass since it wasn't asked for and isn't expected to be significant at these tables' write
  frequencies (all three are write-rarely, read-often).
- **Did search semantics change?** No — case-insensitive partial (`ILIKE '%term%'`) match
  semantics are byte-for-byte preserved; only the execution path changed (index-assisted instead
  of sequential scan). Confirmed no product-facing behavior change: pagination, ordering, and
  filter combination logic in `teachers.service.ts` are untouched.
- **Did any authorization rule change?** No — confirmed by the full authorization/security
  regression suite passing unchanged, and by inspection (every change in this batch is either a
  schema-only index or a data-fetching refactor preserving identical `where` filters).
- **Did any cache accidentally get introduced?** No — PERF-310 was explicitly not touched;
  `slotsForCandidates`'s in-memory `Map` groupings exist only for the duration of a single request
  and are not a cache (no cross-request state, no TTL, nothing persisted).
- **Did compression create deployment ambiguity?** Documented explicitly: no reverse
  proxy/CDN exists in this repository today, so there was no ambiguity to introduce — but this
  is worth re-checking if/when a production reverse proxy or CDN is added to the deployment, to
  avoid double compression at that point (not a concern today).
- **Are migrations production-safe?** Both migrations use plain (non-`CONCURRENTLY`) DDL, which is
  safe for these tables at their current size and is what `prisma migrate deploy`'s transactional
  model requires by default. The PERF-301 migration includes an explicit, documented recommendation
  to run its four GIN index creations via `CREATE INDEX CONCURRENTLY` by hand in production instead
  of through the default deploy path, given `Teacher` is a frequently-written, publicly-read table.
  The PERF-302/303 migration contains only the two evidence-backed user-scoped indexes; unrelated
  schema/database drift was excluded during final pre-commit review.

---

## Recommended Phase 3 Batch 2

In the original report's own priority order, adjusted for what Batch 1 changed:

1. **PERF-304** (`User` listing index) — same trivial shape as PERF-302/303, still open, lowest
   risk remaining item.
2. **PERF-305** (payout-batch sequential transfer loop) — the report's own recommended fix
   (batch the teacher lookup, then evaluate parallelizing the upserts) follows the same
   query-elimination-first discipline this batch applied to PERF-306; not done here because it
   wasn't in the approved list.
3. **PERF-307** (reconciliation/settlement sweep concurrency) — bounded-concurrency, external
   gateway-facing; lower urgency than 305 since nothing user-facing waits on it.
4. **PERF-308** (connection pool sizing) — worth revisiting now with real numbers: Batch 1's
   changes are all query-reducing or read-only-index-adding, so they don't raise this urgency:
   PERF-306 specifically *lowers* concurrent connection demand versus the report's original
   `Promise.all` suggestion, which is one less reason to size the pool up. Still an open
   operational decision (target replica count, actual Postgres `max_connections`) this audit can't
   make unilaterally.
5. **PERF-314** (new, this pass) — evaluate `relationLoadStrategy: 'join'` scope/impact.
6. **PERF-310/311** (caching) — per the reassessment above, scope to the **CACHE OPTIONAL** rows
   only if pursued; not urgent given Batch 1's fixes already addressed the compounding-with-a-bad-
   query risk the original report's HIGH severity partly rested on.
7. **PERF-309** (async OTP send) and **PERF-313** (compose resource limits) — both explicitly
   flagged in the original report as needing a product/operational decision this audit can't make
   alone; unchanged by anything in this batch.

LOAD-001 (inherited) is still open and still needs a production-build load test to confirm
magnitude — PERF-301's fix (this batch) is the most likely root cause per the original report's
analysis, but that's a hypothesis this pass's tiny dev dataset cannot confirm or deny; a real
load test remains the only way to close LOAD-001 with evidence rather than inference.
