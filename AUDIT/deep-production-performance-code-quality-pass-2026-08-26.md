# Deep Production Performance & Code Quality Audit — Pass after Continuation Baseline

Date: 2026-08-26  
Scope: current working tree, read-only. The preceding `production-readiness-continuation-2026-08-26.md` is the locked baseline. Its closed findings, `FE-001..005`, `BE-001..005`, `PROD-001`, `UX-001/002`, `ARCH-301`, `DESIGN-001`, and `INV-01..07` were not re-filed.

## Measurement boundary

The local database is not production-shaped (largest measured tables: 50 notifications, 49 deliveries, 29 users). Local latency is therefore recorded only as a sanity check, never as a production estimate. A live development API returned 10,355 bytes for `/teachers?page=1&limit=12`, 1,199 bytes for the demo teacher profile, and 1,864 bytes for `/languages`; these three current payloads are not large. PostgreSQL `EXPLAIN (ANALYZE, BUFFERS)` was run read-only for the two append-only feed shapes described in `BE-008`; both currently use sequential scan plus sort, but finish below 0.2 ms only because the tables contain fewer than 50 rows.

## 1. NEW FINDINGS ONLY

### PROD-002

**Role:** Product Manager / Senior Backend Engineer  
**Severity:** Critical  
**File:line:** `apps/api/src/modules/commerce/payments/payments.controller.ts:29-33`; `apps/api/src/modules/commerce/payments/payments.service.ts:243-250`; `apps/web/src/app/payment/development/page.tsx:12-15`  
**Function/Endpoint:** `GET /payments/callback`; production payment return journey  
**Evidence:** the gateway callback URL is the API URL `/api/payments/callback`. The controller returns `PaymentsService.callback()` as JSON and has no HTTP redirect. The development simulator conceals this mismatch by calling that API with `fetch`, then doing its own `router.replace('/payment/success')`; Zarinpal returns the production user's browser directly to the API URL, so this client-side redirect never runs. Repository search found no redirect adapter on the callback.  
**Production Impact:** a successfully or unsuccessfully returning payer lands on raw JSON instead of success/failure/pending UX. The payment may be settled correctly in the database while the visible completion journey fails, causing repeat attempts, abandonment, and support tickets.  
**Root Cause:** settlement and browser-delivery concerns are coupled into a JSON API handler, while only the simulator owns the final navigation.  
**Exact Fix:** keep settlement idempotent, but make the public callback adapter issue a 302/303 to an allowlisted configured web origin and a localized `/payment/success`, `/payment/failure`, or `/payment/pending` result. Do not accept a caller-controlled return URL. Preserve an opaque payment/reference token so the result page can read authoritative status; ambiguous provider/network outcomes go to pending and reconciliation.  
**Risk:** Medium; incorrect status mapping or an open redirect would be worse. Callback replay and settlement invariants must remain unchanged.  
**Test:** HTTP integration tests for `OK`, `NOK`, provider error, already-settled callback and ambiguous verification; assert redirect host/path and exactly-once ledger/booking transition. Run a real sandbox browser round trip, not only the development simulator.  
**Before/After Measurement:** production callback journeys reaching a designed result page `0% -> 100%`; duplicate settlement target `0`; track callback-to-result-page completion and pending-to-reconciled age.

### BE-006

**Role:** Senior Backend Engineer  
**Severity:** High  
**File:line:** `apps/api/src/modules/teachers/teachers.service.ts:128-148`  
**Function/Endpoint:** `GET /teachers/:slug`; `TeachersService.profile()`  
**Evidence:** after loading the public profile and its relations, the service runs a booking count and a second `booking.findMany({ distinct: ['studentId'], select: { studentId: true } })`, then calculates `students.length` in Node. That second query transfers and materializes one row per distinct lifetime student solely to obtain a scalar. It grows with a teacher's full completed-booking history.  
**Production Impact:** popular teacher profiles are an acquisition/booking hot path. Heap allocation, DB-to-API bytes, and query time grow O(distinct lifetime students), even though the response exposes one number.  
**Root Cause:** Prisma's convenient `distinct` result is being used as an aggregate count.  
**Exact Fix:** compute `COUNT(DISTINCT student_id)` in PostgreSQL through a parameterized typed query/repository projection, or maintain a transactional/reconcilable teacher-stat projection only if measured read volume justifies that extra invariant. Keep the successful-class count in SQL. Do not add Redis before removing this per-read linear work.  
**Risk:** Low-Medium; raw SQL must retain all attendance/status predicates and safe parameterization. A projection raises consistency/reconciliation risk.  
**Test:** seed one teacher with 100k completed bookings and repeated students; compare result with the current implementation, inspect SQL and heap delta, and cover `attendanceStudent=false/null`.  
**Before/After Measurement:** rows returned for `studentsCount` `D distinct students -> 1 aggregate row`; Node array allocation `O(D) -> O(1)`. Benchmark profile p95 and `EXPLAIN (ANALYZE, BUFFERS)` at realistic cardinality.

### BE-007

**Role:** Senior Backend Engineer / Senior Frontend Engineer  
**Severity:** High  
**File:line:** `apps/api/src/modules/bookings/bookings.repository.ts:34-73`; `apps/web/src/app/dashboard/page.tsx:33-45`; `apps/web/src/features/teacher/components/teacher-dashboard.tsx:34-54`; `apps/web/src/features/scheduling/components/teacher-planner-calendar.tsx:36-60,136-166`  
**Function/Endpoint:** `GET /bookings/me`; student dashboard, teacher dashboard and planner  
**Evidence:** both student and teacher repository branches return every lifetime booking without `take`, cursor, or date window and include teacher languages, student contact data, class record, payment and review. Consumers need different subsets: the student dashboard scans for one next booking and totals; the teacher dashboard filters/sorts all rows for counters; the calendar filters the same full array once per displayed day. The endpoint is cached under both `['bookings']` and `['/bookings/me']`, preventing cache reuse across these surfaces.  
**Production Impact:** database relation materialization, JSON serialization, browser memory and calendar render work grow with account age. For B bookings and roughly 42 calendar cells, the planner's current repeated filters are O(42B), while the initial response itself is O(B) with several relations.  
**Root Cause:** one lifetime-detail contract serves summary, calendar and history use cases.  
**Exact Fix:** expose purpose-specific bounded reads: dashboard summary/next booking; calendar `from/to` range; history cursor page with stable `startsAt,id`; detail by ID. Use narrow selects per projection and a canonical query-options/key factory for each contract. Do not merely paginate the current calendar endpoint because it needs a date window, not arbitrary pages.  
**Risk:** Medium; contract split, cache invalidation, time-zone boundaries and cursor tie handling require care.  
**Test:** 10k-booking account; query-count/rows/bytes for summary, month and 50-row history; equal-`startsAt` cursor test; DST/time-zone calendar boundary; React render/DOM count with Profiler.  
**Before/After Measurement:** initial dashboard rows `B -> O(1)` summary plus next booking; month calendar `B lifetime -> bookings in requested interval`; calendar grouping target `O(Bmonth + 42)` instead of `O(42B)`; initial JSON target `<50 KB` per projection.

### BE-008

**Role:** Senior Backend Engineer  
**Severity:** Medium  
**File:line:** `apps/api/src/modules/notifications/notifications.service.ts:7-11`; `apps/api/src/system/audit/audit.service.ts:8`; `apps/api/prisma/schema.prisma:1091-1103,1279-1293`  
**Function/Endpoint:** newest 200 notification deliveries; newest 200 audit events  
**Evidence:** both append-only feeds execute `ORDER BY createdAt DESC LIMIT 200`. `NotificationDelivery` has no index; `AuditLog` has `(entity,entityId)` and `(actorId,createdAt)`, neither can satisfy an unfiltered global `createdAt` order. Read-only local plans are `Seq Scan -> Sort -> Limit` for both (49 and 17 rows, respectively). The query shape becomes a full scan/sort as the tables grow.  
**Production Impact:** delivery telemetry and audit logs commonly become among the largest tables. Admin feed latency, DB CPU and buffer reads grow with total history rather than 200 returned rows.  
**Root Cause:** indexes cover per-user/per-entity access but not the implemented global newest-first feeds.  
**Exact Fix:** after a production-sized benchmark, add B-tree indexes on `createdAt` (PostgreSQL can scan backward; explicit DESC is optional). Build concurrently in production and retain only if the feed is operationally used. If later filtered by status/channel, benchmark that exact shape before proposing a wider/partial index.  
**Risk:** Low-Medium; added storage and write amplification on append-heavy tables; concurrent migration cannot run inside a normal transaction.  
**Test:** seed 1M deliveries/audit rows, `ANALYZE`, compare plans/buffers and insert throughput; verify newest ordering with equal timestamps.  
**Before/After Measurement:** expected plan `full scan + sort -> backward index scan + limit`; target rows visited near 200 and no sort spill. Record index bytes and insert p95 before accepting.

### BE-009

**Role:** Senior Backend Engineer / Staff Software Engineer  
**Severity:** Medium  
**File:line:** `apps/api/src/modules/learning/dto/request/plan.dto.ts:3-9`; `apps/api/src/modules/learning/learning.service.ts:30-59`  
**Function/Endpoint:** `POST /learning/plans`; `GET /learning/plans`  
**Evidence:** `weakSkills` and `milestones` validate only `IsArray`; milestone children are plain TypeScript shapes with no runtime nested validation, unique/order rule, string limits, or array maximum. The service maps every supplied milestone into nested writes. The read side returns every lifetime plan with all milestones and all assignments and has no bound.  
**Production Impact:** an authenticated request can create attacker-controlled array work and a large nested write; account-age growth produces unbounded relation objects and JSON on every plans view.  
**Root Cause:** transport bounds and list/detail boundaries are absent. Business ownership checks are correctly in the service and should stay there.  
**Exact Fix:** add concrete `MilestoneDto`, `@ValidateNested({each:true})`, transformation, realistic `ArrayMaxSize`, field length/date validation and unique order checks; constrain `weakSkills` elements and size. Return a bounded compact plan list and fetch assignments/milestones in detail or bounded recent subsets. Use `updatedAt,id` for a stable cursor.  
**Risk:** Medium; maxima must follow real curriculum constraints and old clients may rely on the full nested response.  
**Test:** malformed child/max+1/duplicate-order validation; query-count and payload at 1k plans; stable cursor with equal timestamps; ownership regression tests.  
**Before/After Measurement:** per-request milestones `unbounded -> configured maximum`; initial plans/relations `all lifetime -> page size (target 20)`; capture SQL count, JSON bytes and transaction duration at maximum accepted input.

### FE-006

**Role:** Senior Frontend Engineer / Product Manager  
**Severity:** Medium  
**File:line:** `apps/web/src/app/checkout/page.tsx:54-89`  
**Function/Endpoint:** booking checkout submission  
**Evidence:** one click serially awaits `POST /bookings`, then `POST /payments`, then `POST /payments/:id/gateway`, before navigating to the provider. This is a minimum of three browser/API round trips plus database work and external-provider latency. `reservedRef` correctly prevents a known duplicate reservation on retry, but it exists only in memory and each payment attempt creates a fresh idempotency key.  
**Production Impact:** gateway entry latency includes three RTTs; on mobile/high-latency networks 150 ms RTT alone adds at least ~450 ms before server/provider time. Refresh or cross-device recovery loses the in-memory reservation context.  
**Root Cause:** internal workflow boundaries are exposed as a client orchestration sequence rather than a durable checkout command.  
**Exact Fix:** benchmark first. If material, add one idempotent checkout application endpoint that reserves/reuses the booking and creates/reuses payment atomically, commits, then requests/resumes the gateway outside the DB transaction. Persist/reuse a checkout idempotency key across UI retries. Return either paid state or provider URL. Keep the lower-level endpoints for internal/recovery use.  
**Risk:** Medium-High; merging calls incorrectly could hold a DB transaction across provider I/O or weaken existing payment invariants.  
**Test:** slow-RTT E2E; double-click, refresh and retry with the same key; provider timeout after commit; booking created/payment failed recovery; exactly one active reservation/payment.  
**Before/After Measurement:** browser API RTTs before redirect `3 -> 1`; target gateway-start p95 improvement must exceed implementation cost; duplicate active bookings/payments target `0`.

### PROD-003

**Role:** Product Manager / Product Designer  
**Severity:** High  
**File:line:** `apps/web/src/app/teachers/[id]/page.tsx:27-31`; `apps/api/src/modules/teachers/teachers.service.ts:153-180`  
**Function/Endpoint:** public teacher intro video  
**Evidence:** the profile always renders a large video-like gradient and play icon, but the element is not a button/player and has no source or click handler. Teachers can upload an intro video and the public projection includes only `introVideoKey`; the public page never consumes it.  
**Production Impact:** a prominent discovery affordance promises an interaction that succeeds 0% of the time. It consumes above-the-fold space and can lower teacher trust/conversion, especially because video is a high-information selection aid.  
**Root Cause:** upload/moderation data and public delivery/player were not completed end-to-end; the visual placeholder shipped as if interactive.  
**Exact Fix:** either render a clearly non-interactive poster until launch, or complete approved-file delivery with a poster, accessible play button, controls/captions path, lazy loading and safe signed/public URL policy. Never expose unapproved/raw storage keys.  
**Risk:** Medium; media privacy, moderation, bandwidth and LCP can regress if video autoloads. Do not autoplay/download the video above the fold.  
**Test:** approved/unapproved/missing video cases; keyboard and screen-reader controls; slow network; signed URL expiry; mobile aspect ratio.  
**Before/After Measurement:** current play success `0%`; target interaction success `100%` for approved videos and initial video bytes `0` until user intent; track profile-to-checkout conversion.

### PROD-004

**Role:** Product Manager / Senior Frontend Engineer  
**Severity:** Medium  
**File:line:** `apps/web/src/features/student/components/student-matches.tsx:28-41,78-87`  
**Function/Endpoint:** matching-history teacher filters  
**Evidence:** `type` state is changed by a visible “private/group/all” filter, but the memoized filtering logic ignores it and the dependency list omits it. The returned `Teacher` model shown here has no class-type field. All three selections therefore produce the same cards.  
**Production Impact:** a core discovery control gives false feedback, making users believe unavailable group/private constraints were applied and weakening trust in matching.  
**Root Cause:** UI capability was added without a corresponding domain/result attribute.  
**Exact Fix:** remove the filter until class types exist, or add an explicit supported-class-types field derived from bookable products and apply it server/client-side. Do not infer group availability from price or labels.  
**Risk:** Low if removed; Medium if the business model is expanded.  
**Test:** interaction test asserting each option changes result IDs/count; zero-result empty state; analytics for use and downstream conversion.  
**Before/After Measurement:** filter selections affecting results `0/3 -> all supported options`; misleading no-op controls `1 -> 0`.

### UX-003

**Role:** Senior UI/UX Designer / Senior Frontend Engineer  
**Severity:** Medium  
**File:line:** `apps/web/src/features/scheduling/components/teacher-planner-calendar.tsx:270-332`; `apps/web/src/features/admin/components/admin-users-manager.tsx:302+`; `apps/web/src/features/admin/components/admin-finance-center.tsx:300-356`; `apps/web/src/features/support/components/my-ticket-manager.tsx:208-267`  
**Function/Endpoint:** planner note, admin user, transfer and support-ticket modal overlays  
**Evidence:** at least four independently implemented fixed overlays lack `role="dialog"`, `aria-modal`, a focus trap, Escape handling and focus restoration; repository search finds those semantics only in the shared Jalali picker. Some close controls are icon-only without an accessible label.  
**Production Impact:** keyboard/screen-reader users can move behind a modal, lose their return position, or be unable to understand/close critical finance/support dialogs. Mobile users also get inconsistent dismissal behavior.  
**Root Cause:** dialog behavior is duplicated as styling rather than owned by an accessible primitive. This is proven reuse across four consumers, not speculative abstraction.  
**Exact Fix:** introduce one narrow shared Dialog primitive using the platform/established accessible library: labelled title/description, focus trap, Escape, backdrop policy, return focus, scroll lock/inert background and accessible close label. Migrate the four dialogs without merging their domain forms.  
**Risk:** Low-Medium; nested popovers and backdrop-close behavior need regression coverage.  
**Test:** keyboard-only tab loop/Escape/return focus; axe; screen-reader name; mobile viewport/virtual keyboard; prevent accidental close during pending money action.  
**Before/After Measurement:** audited conforming dialogs `0/4 -> 4/4`; automated critical dialog accessibility violations target `0`.

### DESIGN-002

**Role:** Product / Visual Designer / Senior UI/UX Designer  
**Severity:** Medium  
**File:line:** `apps/web/src/features/student/components/student-matches.tsx:43-139`; `apps/web/src/features/student/components/student-tests.tsx:14-120`; `apps/web/src/features/student/components/student-profile.tsx:1-100`  
**Function/Endpoint:** English student panel sections and navigation  
**Evidence:** these student sections hard-code Persian copy/labels/statuses and do not consume the locale layer, while the surrounding panel shell is bilingual. `StudentMatches` links to `/matching` and `StudentTests` to `/placement` without `localePath`, dropping an English user onto the FA route. This finding excludes the wallet already covered by `DESIGN-001`.  
**Production Impact:** `/en/dashboard/*` mixes English chrome with Persian financial/learning content and silently changes locale during primary navigation. Direction, numeral and terminology consistency degrade across the core journey.  
**Root Cause:** localization and locale-safe navigation are implemented per component rather than enforced at the panel-section boundary.  
**Exact Fix:** move visible copy/status labels into the existing locale catalog/hooks, wrap internal links with `localePath`, use logical properties, and define empty/error/loading/status variants for both locales. Add a repository test for hard-coded root links in localized panel components.  
**Risk:** Low; translations need product review, especially assessment terminology.  
**Test:** FA/EN snapshots at 360px and desktop; assert `lang/dir`, no Persian strings in EN fixture, locale-preserving links, keyboard traversal.  
**Before/After Measurement:** affected non-wallet student sections `3 -> 0`; identified locale-dropping CTAs `2 -> 0`.

### ARCH-302

**Role:** Staff Software Engineer / Senior Backend Engineer  
**Severity:** Low  
**File:line:** `apps/api/prisma/schema.prisma:468-469`  
**Function/Endpoint:** `AvailabilityOverride` persistence  
**Evidence:** the model declares both `@@unique([teacherId,date])` and `@@index([teacherId,date])`. PostgreSQL implements the unique constraint with a B-tree that already supports the same equality/range prefix; the second index is structurally identical for reads. Local catalog inspection confirms two physical indexes; the redundant one had zero scans while the unique index had scans, but the decision rests on identical definitions rather than the tiny dev statistics.  
**Production Impact:** every override insert/update pays unnecessary index maintenance, WAL and storage. Impact is bounded by override write volume, so severity is Low.  
**Root Cause:** an explicit lookup index was added without accounting for the index backing the unique constraint.  
**Exact Fix:** remove only the explicit duplicate via a reviewed migration; retain the unique constraint. Confirm no operator class/include/predicate difference in production catalog.  
**Risk:** Low; migration locking must still be scheduled appropriately.  
**Test:** compare `pg_indexes`, run the exact teacher/date lookup plan, uniqueness test, and write smoke test after migration.  
**Before/After Measurement:** indexes on identical key `2 -> 1`; measure index bytes and override write WAL/latency at representative volume.

## New INVESTIGATED — NO CHANGE REQUIRED

- **INV2-01 — Locale context rerender:** `LocaleProvider` creates a new value/function per provider render, but locale changes legitimately require all 37 translation consumers to rerender and the provider is not backed by fast-changing state. Memoization has no demonstrated production benefit.
- **INV2-02 — Matching slot CPU:** candidate slot computation is bounded to 40 teachers and a maximum 31-day range, with batched database reads already accepted in the baseline. It should be CPU-profiled at maximum rules/blocks/bookings, but no event-loop defect is proven now.
- **INV2-03 — Queue worker exists:** booking jobs have an actual BullMQ worker, attempts/backoff and concurrency 5. Provider limits and production backlog are unknown; changing concurrency/retries without those measurements is unjustified.
- **INV2-04 — Public payload sample:** measured demo responses for teacher profile and languages are small. No generic compression/select/cache finding is filed from these samples.
- **INV2-05 — Prisma relation includes:** relation batching remains fixed-count, as established by the baseline. `BE-007/009` concern unbounded rows and contracts, not fabricated N+1.
- **INV2-06 — Calendar filtering:** O(42B) becomes material only because `B` is an unbounded lifetime response. Once `BE-007` supplies a month window, a simple grouping map is sufficient; a standalone frontend optimization is not filed.

## 2. CACHE CANDIDATE MATRIX

Traffic labels are expected product patterns and must be replaced with observed RPS/hit rate before rollout.

| Endpoint/Data | Read frequency | Mutation frequency | Freshness requirement | Suggested TTL | Invalidation | Cache key | Risk | Decision |
|---|---:|---:|---|---:|---|---|---|---|
| Public teacher directory | High | Low-medium | 30–60 s acceptable for profile text; availability excluded | 30–60 s | teacher approval/profile/price/language mutation; version bump | `teachers:list:v2:<canonical filters,page>` | key cardinality; stale prices | **Candidate only after hit-rate measurement**; cache bounded popular pages, never slot data |
| Public teacher profile | High for popular teachers | Low-medium | price/approval should refresh quickly | 30–60 s | profile, approved price/package, published review, media moderation | `teacher:public:v2:<slug>` | many invalidators; stale commerce data | **Optimize BE-006 first; then candidate** if repeated reads are measured |
| Active languages | High/common bootstrap | Very low | minutes acceptable | 5–10 min | admin language mutation; version bump | `languages:active:v1:<locale>` | low | **Good candidate**, or CDN/HTTP revalidation before Redis |
| Public CMS page/settings | Medium-high | Very low | 1–5 min acceptable except emergency notices | 60–300 s | admin publish/update | `cms:v1:<slug>:<locale>` | emergency stale content | **Good candidate** with explicit purge; CDN preferred for public responses |
| Published test catalog/definition | Medium | Low | publication changes should be prompt | 60–300 s | publish/unpublish/edit/version creation | `tests:published:v1:<languageId>` / `test:def:<id>:<version>` | stale exam content during active attempt | **Catalog candidate**; do not cache mutable attempt state |
| Admin dashboard projection | Medium | Continuous trigger updates | near-real-time | n/a | n/a | n/a | double-cache drift | **No cache**; `DashboardStat` is already the read projection |
| `/users/me`, roles, permissions | High per session | Medium/security-sensitive | immediate | n/a | complex/account switch | n/a | privilege/identity leak | **No cache** beyond short in-process/client request dedupe already scoped by `FE-002` |
| Availability/booking slots | High | High/time-sensitive | immediate | n/a | booking/block/rule races | n/a | oversell/stale slots | **No cache**; correctness-sensitive |
| Booking/payment/wallet/payout/finance | Medium-high | High | authoritative | n/a | financial state machine | n/a | stale balance/status, cross-user leak | **No cache** |
| Matching/history/learning plans | Per-user | Medium | user-specific | client stale-time only | per-user mutations | user-scoped query keys | privacy and low sharing | **No Redis**; bound/paginate contracts |
| Support tickets/notifications | Per-user/admin | High | seconds/immediate | n/a | frequent replies/read state | n/a | stale operations and privacy | **No cache** |

Stampede controls, only for accepted shared candidates: single-flight per exact bounded key, 10–20% TTL jitter, short stale-if-error only for non-sensitive public data, maximum key cardinality, metrics for hit rate/load latency/evictions, and event-driven version invalidation. Do not cache arbitrary search strings indefinitely.

## 3. TOP DATABASE HOTSPOTS

| Rank | Query shape | Why it scales poorly / status | Required EXPLAIN dataset |
|---:|---|---|---|
| 1 | `/bookings/me` lifetime root plus several relations | Unbounded rows and relation payload (`BE-007`) | 10k bookings/user, realistic relations; compare summary/month/cursor projections |
| 2 | teacher profile `distinct studentId` materialization | O(distinct lifetime students) for one scalar (`BE-006`) | 100k bookings/teacher, skewed students; compare `COUNT(DISTINCT)` |
| 3 | learning plans with all milestones/assignments | Unbounded nested lifetime graph (`BE-009`) | 1k plans/user, 20 milestones and 50 assignments/plan |
| 4 | notification-delivery newest 200 | no global `createdAt` index (`BE-008`) | 1M+ append rows; buffers, sort spill, insert cost |
| 5 | audit-log newest 200 | composite indexes cannot serve global order (`BE-008`) | 1M+ rows; same measures |
| 6 | checkout three-command workflow | connection/latency chain rather than one SQL defect (`FE-006`) | concurrent checkout with provider delay; pool wait and transaction duration |

Candidate indexes are limited to the two exact global feed shapes in `BE-008`; the identical override index should be removed (`ARCH-302`). Dev `pg_stat_user_indexes` zero-scan values are not used to recommend dropping any other index. Cursor migrations must order by a unique tuple (`startsAt,id` or `updatedAt,id`); ordering by time alone is not stable under equal timestamps and concurrent inserts.

## 4. TOP FRONTEND RUNTIME HOTSPOTS

1. `/bookings/me` consumers: lifetime response plus multiple relation objects; planner repeats filters for ~42 day cells. Expected improvement is dominated by the API contract in `BE-007`, not memoization theatre.
2. Checkout: three sequential API RTTs before provider redirect (`FE-006`); measure on 150 ms RTT and slow provider.
3. Matching filter: one state change causes a render but zero result change (`PROD-004`); remove or implement the capability.
4. Payment return: production browser never enters web result UX (`PROD-002`), making perceived completion worse than any render optimization.
5. Intro-video affordance: zero functional interaction; a real implementation must lazy-load media to avoid LCP/network regression (`PROD-003`).
6. Accessible dialog migration: four custom overlays need one tested behavior primitive (`UX-003`).

Previously measured catch-all bundle outliers, global dynamic rendering, `/users/me` duplicate keys and wallet eager queries remain in the locked baseline and are intentionally not repeated here.

## 5. TOP CODE-QUALITY HOTSPOTS

1. Payment callback delivery boundary: settlement API semantics leak directly into a browser navigation (`PROD-002`).
2. Booking read repository: one broad domain graph serves dashboard, calendar and history (`BE-007`), increasing change and payload blast radius.
3. Learning DTO/read contract: runtime validation is weaker than its TypeScript declaration and list/detail responsibilities are mixed (`BE-009`). The DTO-validation rule directly shaped the fix: request shape/bounds in DTOs, relationship invariants in the service.
4. Dialog implementations: proven behavioral duplication across four domains (`UX-003`). The reuse boundary should be the accessible Dialog behavior, not domain form fields.
5. AvailabilityOverride indexes: redundant schema intent creates real write/storage cost (`ARCH-302`).
6. Nest startup emitted three legacy wildcard-route conversion warnings for `/api/*`. Current startup succeeded, so this is not filed as an outage; replace legacy middleware path syntax before the next Nest major upgrade and add a boot-log warning gate.

## 6. PRODUCT / UX / DESIGN GAPS

| Journey | New gap | User consequence |
|---|---|---|
| Signup | No new evidence-backed blocker beyond baseline | — |
| Search / Teacher | non-functional intro-video affordance (`PROD-003`) | discovery promise cannot be completed |
| Matching | class-type filter is a no-op (`PROD-004`) | false confidence in result constraints |
| Booking / Checkout | three-step network orchestration (`FE-006`) | slower, less durable gateway entry |
| Payment | callback ends on JSON API (`PROD-002`) | core paid journey has no designed completion |
| Wallet | locked baseline findings only | not repeated |
| Dashboard | lifetime booking/learning contracts (`BE-007/009`) | worsening load and DOM with tenure |
| Support/Admin | inaccessible custom dialogs (`UX-003`) | keyboard/screen-reader dead ends |
| English panel | three student sections remain Persian and two CTAs drop locale (`DESIGN-002`) | bilingual journey breaks mid-flow |

Visual consistency evidence supports sharing only a few behavior-rich primitives first: Dialog, Alert/Error with retry semantics, and StatusBadge with semantic tones. Many repeated hard-coded colors exist, but a wholesale token rewrite is not justified until visual regression coverage exists; `UX-003` is the highest-value first extraction.

## 7. MASTER BACKLOG DELTA

### P0 — add to baseline

1. `PROD-002`: return production payment callbacks to authoritative web success/failure/pending UX.

### P1 — add to baseline

1. `BE-006`: replace lifetime distinct-student materialization with a scalar database aggregate.
2. `BE-007`: split `/bookings/me` into bounded dashboard/calendar/history projections.
3. `PROD-003`: remove the false video affordance or complete approved lazy media delivery.
4. `BE-009`: bound/validate learning plan arrays and paginate nested lifetime reads.
5. `BE-008`: validate and add newest-feed indexes at production cardinality.

### P2 — add to baseline

1. `FE-006`: collapse checkout orchestration only after RTT/provider measurements confirm ROI.
2. `PROD-004`: remove or implement the no-op class-type filter.
3. `UX-003`: migrate four overlays to an accessible Dialog primitive.
4. `DESIGN-002`: finish localization and locale-safe navigation in non-wallet student sections.

### P3 — add to baseline

1. `ARCH-302`: remove the structurally duplicate override index in a safe migration.
2. Replace legacy Nest `/api/*` route syntax before framework upgrade; no current production failure is demonstrated.

## 8. TOP 10 NEXT ACTIONS

1. Fix and sandbox-test the real payment callback redirect journey (`PROD-002`).
2. Define bounded booking summary/month/history contracts and seed-test at 10k rows (`BE-007`).
3. Replace teacher-profile distinct-row materialization with verified `COUNT(DISTINCT)` (`BE-006`).
4. Gate or complete the public teacher intro video; do not retain a fake play control (`PROD-003`).
5. Add nested learning-plan DTO bounds, then split list/detail responses (`BE-009`).
6. Run 1M-row feed EXPLAIN/write benchmarks and add only the justified `createdAt` indexes (`BE-008`).
7. Remove the matching class-type control unless real class-type data is delivered (`PROD-004`).
8. Implement and migrate to one accessible Dialog primitive (`UX-003`).
9. Localize the three remaining student sections and preserve `/en` in CTAs (`DESIGN-002`).
10. Measure checkout at realistic RTT; implement a durable idempotent application command only if the measured p95 gain warrants the risk (`FE-006`).

## 9. MUST-BENCHMARK BEFORE PRODUCTION

1. Production payment sandbox round trip: provider return, callback settlement, browser redirect, replay, ambiguous timeout and reconciliation age.
2. `/bookings/me` replacement shapes at 10k rows/account: SQL statements, rows, buffers, payload bytes, serialization, heap delta, DOM nodes and React commit time.
3. Teacher profile at 100k bookings/teacher: current distinct materialization vs `COUNT(DISTINCT)`, including buffers and heap.
4. Learning plan create/read at maximum accepted milestones and 1k lifetime plans: validation CPU, transaction duration, query count and payload.
5. NotificationDelivery/AuditLog at at least 1M representative rows: `EXPLAIN (ANALYZE, BUFFERS)`, sort spill, index size and insert/WAL penalty.
6. Checkout on mobile-like 150 ms RTT plus provider p95/p99: click-to-redirect, pool wait, active transactions and retry duplication.
7. Matching maximum bounded workload (40 candidates × 31 days): CPU profile, event-loop delay and response p95; change nothing unless measured.
8. BullMQ at expected peak: enqueue rate, concurrency 5 throughput, provider-rate compliance, retries, oldest-job age and graceful shutdown.
9. Public cache experiment only for accepted candidates: per-key hit rate, origin p95, invalidation lag, key cardinality, stampede count and stale-content incidents.
10. Web Vitals/Profiler on mid-tier mobile for teacher discovery, checkout, dashboard month calendar and dialogs: LCP, INP, CLS, transferred media/JS, commit duration and accessibility violations.

