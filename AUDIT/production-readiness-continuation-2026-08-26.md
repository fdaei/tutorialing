# Production Readiness Audit — Continuation after Phase 3 Batch 2

Date: 2026-08-26  
Scope: current working tree (including the uncommitted architecture migration), `AUDIT.zip`, all files under `AUDIT/`, `apps/api`, and `apps/web`.  
Mode: read-only audit; no product source was changed.

## 1. Continuation baseline

The archive available in the workspace is named `AUDIT.zip` (SHA-256
`49141ca7c5cebeed3ed57eab6566b48b4ff831dd5badb8cea33d88c42cca76b5`) and contains the same 38
audit artifacts represented under `AUDIT/`. This pass starts after Performance Phase 3 Batch 2 and
does not reopen a closed item without contradictory current-code evidence.

### FIXED / VERIFIED — not repeated

| IDs | Current baseline decision |
|---|---|
| `FIN-102` | refund-over-capture race fixed and regression-tested |
| `SEC-203/205/206/207/208/209/210` | security fixes verified by prior gates |
| `STR-201/202`, `AUD-002` | lint/import/conflict-marker issues fixed |
| `PERF-301/302/303/304/305/306/312` | trigram/index/set-based query/compression work completed; 304/305 remain uncommitted in this snapshot |
| `PERF-314` | measured fixed-count Prisma relation batching; not N+1; no change required |
| `ARCH-001..013` from `deep-semantic-architecture-audit.md` | semantic architecture findings were implemented in the current uncommitted migration; not re-filed here |

### OPEN

`AUD-001`, `SEC-201`, `SEC-202`, `SEC-211`, `RBAC-001`, `TEST-001`, `FIN-103`, `LOAD-001`,
`PERF-308` (production configuration required), `PERF-309` (product decision), `PERF-310`
(cache optional), `PERF-311` (cache policy required), and money migration `MIG-001` steps 2–5.

### FALSE POSITIVE / ACCEPTED / NO ACTION

- `PERF-314`: Prisma `include` creates a fixed query per included relation, not a query per root row.
- `PERF-307`: sequential provider reconciliation is retained until backlog, duration and provider-rate evidence exists.
- `PERF-313`: development Compose limits are not evidence for production scheduler sizing.
- `RATE-008`: fixed-window boundary burst is an explicitly accepted trade-off.
- `SEC-006`: CSP origin breadth remains explicitly accepted pending deployment origin data.

### NEEDS RECHECK

- `FIN-101`: **failed recheck**. The shared formatter and its tests still exist, but ten current UI
  call sites again hand-roll `IRR` labels over Toman integers. This is filed below as `FE-001` and
  changes the effective status from VERIFIED to REGRESSED.
- `LOAD-001`: remains a production-build load-test item; the previous likely DB cause was fixed, but
  no production-shaped dataset/concurrency run exists.
- `PERF-308/311`: cannot be closed without the production topology, traffic/SLOs and CDN policy.

## 2. New findings

### FE-001

**Role:** Senior Frontend Engineer / Product Manager  
**Severity:** High  
**File:** `apps/web/src/app/teachers/[id]/page.tsx:20`; `features/teacher/components/teacher-card.tsx:16`;
`app/checkout/page.tsx:109`; `app/matching/page.tsx:85`; `features/teacher/components/teacher-finance.tsx:69,120,139`;
`features/teacher/components/teacher-dashboard.tsx:56`; `features/commerce/components/pricing-manager.tsx:268`;
`features/admin/components/admin-finance-center.tsx:103`; `features/admin/components/admin-users-manager.tsx:485`  
**Function / Endpoint / Component:** teacher discovery, matching, checkout, teacher finance and admin finance money rendering  
**مشکل:** `FIN-101` regression: English UI labels Toman integers as `IRR`, understating the unit by 10×.  
**شواهد:** `lib/money.ts:35-41` is the approved centralized implementation (`Toman` in English), and
`lib/money.spec.ts:8-12` explicitly forbids `IRR`. Nevertheless `rg` finds ten production call sites
that bypass it with `fa ? ' تومان' : ' IRR'`. The highest-risk instance is checkout line 109, immediately
before the amount is used to reserve and pay.  
**اثر در Production:** English users see, for example, a stored `500,000` Toman price as `500,000 IRR`
instead of `500,000 Toman` (a 10× semantic discrepancy) across discovery and purchase confirmation.
This can directly reduce conversion and create payment disputes.  
**چرا مشکل است:** the prior fix centralized the exact invariant, but current components bypass the
only tested API; the unit migration `MIG-001` would also require changing many sites again.  
**راه‌حل دقیق:** replace every hand-built money string and unit label with `formatMoney`,
`formatMoneyOrDash`, and `moneyUnit`; add an ESLint/repository test rejecting UI literals `IRR` and
the conditional `تومان/IRR` pattern outside historical comments/tests. Do not change stored amounts.  
**ریسک راه‌حل:** Low; text-only output change. Verify administrative CSV/export expectations separately
if any are added later.  
**روش تست:** component tests in both locales for TeacherCard, Checkout, TeacherFinance and AdminFinance;
repository scan asserting no runtime `IRR`; manual end-to-end comparison of the same booking amount in FA/EN.  
**Benchmark قبل/بعد پیشنهادی:** correctness benchmark: current runtime call sites bypassing formatter
`10 → 0`; English displayed unit mismatch `100% → 0%` on the ten identified surfaces.

### BE-001

**Role:** Senior Backend Engineer  
**Severity:** High  
**File:** `apps/api/src/modules/commerce/payments/gateway.service.ts:21-25,47-51`  
**Function / Endpoint / Component:** `GatewayService.request()` and `verify()`; checkout gateway start,
callback verification, scheduled reconciliation  
**مشکل:** both Zarinpal HTTP calls have no deadline or cancellation signal.  
**شواهد:** the two `fetch` options contain method/headers/body only. In contrast, the current Kavenegar
adapter uses `AbortSignal.timeout(10_000)` at `kavenegar.provider.ts:31`, proving timeout support is
available and already follows provider-boundary ownership.  
**اثر در Production:** a stalled upstream holds an API request and socket until the OS/network timeout;
callback and reconciliation capacity can accumulate, and users remain on an indeterminate payment state.
At concurrency `C`, up to `C` handlers and their memory remain retained; the callback path's recovery is delayed.  
**چرا مشکل است:** provider latency is outside the application's control, while payment endpoints need a
bounded failure contract and retry/reconciliation path. This is not the deferred question of parallelizing sweeps.  
**راه‌حل دقیق:** add a payment-provider-specific configurable timeout (initially 10–15 s based on measured
p99), pass `AbortSignal.timeout`, normalize timeout/network/invalid-response failures to stable gateway
errors, and emit duration/result metrics. Do not blindly retry `request()` unless its idempotency semantics
are confirmed; let existing payment/reconciliation state handle ambiguous outcomes.  
**ریسک راه‌حل:** Medium: too-short deadlines can turn slow successes into ambiguous failures. Roll out after
capturing provider p95/p99 and keep reconciliation as the correctness backstop.  
**روش تست:** fake a never-resolving fetch and assert bounded rejection; test AbortError normalization;
test successful request/verify and code `101`; E2E simulate timeout then reconciliation.  
**Benchmark قبل/بعد پیشنهادی:** worst-case handler lifetime `OS timeout (potentially minutes) → configured
10–15 s`; record `payment_provider_duration_ms`, timeout rate and pending-payment age p95.

### BE-002

**Role:** Senior Backend Engineer  
**Severity:** High  
**File:** `apps/api/src/modules/commerce/payouts/payouts.service.ts:129-170`  
**Function / Endpoint / Component:** `GET /teacher/finance` / `teacherFinance()`  
**مشکل:** two ever-growing collections (`Earning` and `PayoutItem`) are returned without pagination or `take`;
the method also performs six sequential database round trips.  
**شواهد:** `earnings.findMany` at 131–134 and `payoutItem.findMany` at 141–145 have no bound. Withdrawals alone
are capped at 50. The method awaits teacher, earnings, groupBy, payouts, withdrawals and wallet ledger in
sequence; after resolving teacher, the remaining five reads are independent snapshots for display.  
**اثر در Production:** payload, Prisma materialization, JSON serialization and browser rendering grow O(E+P)
with a teacher's lifetime. A long-tenure/high-volume teacher can turn a dashboard request into MB-scale JSON
and high heap pressure. Minimum query count is 6 SQL statements before relation batching.  
**چرا مشکل است:** this is a primary teacher dashboard flow, not an offline report. A fixed current dev row
count does not bound production history.  
**راه‌حل دقیق:** return summary/totals plus separately cursor-paginated earnings and payouts (20–50 rows);
select only displayed fields. After the teacher lookup, run independent read queries with `Promise.all` only
outside an interactive transaction, or use a short array transaction if one consistent snapshot is required.
Keep the balance aggregates authoritative and uncached.  
**ریسک راه‌حل:** Medium: response contract changes and snapshot semantics must be explicit; do not parallelize
inside a single Prisma interactive transaction.  
**روش تست:** contract tests for cursors and stable tie-breaker (`createdAt,id`), 10k earnings seed, heap/payload
measurement, and concurrent ledger-write test proving summary behavior remains correct.  
**Benchmark قبل/بعد پیشنهادی:** rows `E+P+≤50 → ≤50 per requested page`; initial payload target `<100 KB`;
initial SQL count `6 → 4–6` depending on summary contract, with latency target based on measured p95 rather than guessed.

### BE-003

**Role:** Senior Backend Engineer / Staff Software Engineer  
**Severity:** Medium  
**File:** `apps/api/src/modules/assessment/tests.service.ts:307-312`;
`apps/api/src/modules/matching/matching.service.ts:185-196`  
**Function / Endpoint / Component:** `GET /tests/attempts/history`, `GET /matching/history`  
**مشکل:** user histories are unbounded; matching history additionally materializes every recommendation and
teacher/language relation for every historical session.  
**شواهد:** both `findMany` calls lack `take/skip/cursor`. Matching nests recommendations → teacher →
languageLinks → language. Test history includes test language and all scores. Frontend consumes both as full
arrays (`StudentTests`, `StudentMatches`) with no paging control.  
**اثر در Production:** row count, relation queries, payload and DOM grow with account age; matching is the
heavier path because each session multiplies recommendation objects. Complexity is O(S×R×L) materialized
objects, even though Prisma's SQL count itself is fixed per relation (not N+1).  
**چرا مشکل است:** fixing `PERF-314` by JOIN would not fix the unbounded result set and could worsen row
multiplication. The correct boundary is pagination.  
**راه‌حل دقیق:** cursor pagination with `createdAt,id`, default 20; use a compact list projection and a detail
endpoint for recommendation-rich sessions/attempt details. Preserve current first page in the web and add
load-more/infinite pagination.  
**ریسک راه‌حل:** Medium: contract/UI change and ordering stability.  
**روش تست:** seed 1k sessions with five recommendations each and 1k attempts; assert page bounds, no duplicates
across equal timestamps, and authorization.  
**Benchmark قبل/بعد پیشنهادی:** initial root rows `S → 20`; matching objects roughly `S×R×L → 20×R×L`;
measure SQL count, JSON bytes, serialization time and client DOM nodes.

### BE-004

**Role:** Senior Backend Engineer  
**Severity:** Medium  
**File:** `apps/api/src/modules/assessment/dto/request/save.dto.ts:1-10`;
`apps/api/src/modules/assessment/tests.service.ts:108-180`  
**Function / Endpoint / Component:** `PATCH /tests/attempts/:id/answers` autosave  
**مشکل:** the runtime DTO validates only that `answers` is an array. It has no nested DTO, element validation,
uniqueness, or maximum length; service persistence then performs one sequential update/upsert per supplied answer
inside an interactive transaction.  
**شواهد:** `SaveDto` has only `@IsArray()`. It lacks `@ArrayMaxSize`, `@ValidateNested({each:true})` and
`@Type(() => AnswerDto)`. The service builds an `IN` query from every unique id then loops over the original
array and awaits one write each. Therefore duplicate IDs can cause repeated writes and payload size is unbounded.
The endpoint is rate-limited, but per-request work remains attacker-controlled.  
**اثر در Production:** SQL work is approximately `2–4 + N` statements and transaction duration O(N); a large
authenticated payload can hold a connection, increase lock time, and consume CPU/memory even below the request-rate limit.  
**چرا مشکل است:** array shape/size/unique IDs are transport-boundary rules and belong in a concrete runtime DTO;
question ownership/revision state correctly remains in the service.  
**راه‌حل دقیق:** create `SaveAnswerDto` with UUID/string/type/optional field constraints, apply nested validation,
`ArrayNotEmpty`, `ArrayMaxSize` based on the largest real section, and `ArrayUnique(a => a.questionId)`. Then
use set-based persistence where semantics allow, or enforce the small bound and retain sequential writes.
Do not move cross-record question/test/revision invariants into decorators.  
**ریسک راه‌حل:** Medium: the max must be derived from real test definitions and legacy clients; JSON `value`
shape may require type-specific domain validation.  
**روش تست:** global `ValidationPipe` tests for malformed child, duplicates and max+1; service tests for foreign
question and revision state; query-count test at maximum accepted N.  
**Benchmark قبل/بعد پیشنهادی:** worst-case N `unbounded → configured section maximum`; SQL count remains bounded
at `≤ base + max`, or target constant/set-based writes if implemented.

### BE-005

**Role:** Senior Backend Engineer  
**Severity:** Medium  
**File:** `apps/api/src/modules/support/support.service.ts:164-231`  
**Function / Endpoint / Component:** `POST /support/tickets/:id/replies` for an unassigned ticket  
**مشکل:** a user reply fans out notification creation sequentially inside the ticket transaction, one nested
notification/delivery write per active support recipient.  
**شواهد:** lines 209–213 load all support staff IDs; lines 215–228 execute `await tx.notification.create` in a
loop. Query/write count and transaction duration are O(S), where S is the active support staff count.  
**اثر در Production:** team growth increases customer reply latency and keeps ticket row/transaction resources
open longer. At S=50 the path adds 50 sequential Prisma create operations (plus nested delivery persistence),
although the customer needs only the ticket reply committed synchronously.  
**چرا مشکل است:** this is a safe place for set-based persistence or post-commit delivery orchestration; naive
`Promise.all` inside one Prisma transaction is not the fix.  
**راه‌حل دقیق:** generate notification IDs in application code, `createMany` notifications and `createMany`
IN_APP deliveries in the same transaction, or write a transactional outbox/fan-out job only if telemetry shows
S is large enough to justify async complexity. Preserve idempotency and commit the ticket reply atomically.  
**ریسک راه‌حل:** Medium: bulk IDs, duplicate/retry behavior and atomic delivery rows must be covered. Async fan-out
would change notification timing, so set-based synchronous writes are the lower-risk first option.  
**روش تست:** query-count test at S=1/10/50; rollback test; duplicate job/retry test if async is selected.  
**Benchmark قبل/بعد پیشنهادی:** notification delegate writes `S → 2 createMany operations` (plus recipient lookup);
measure transaction duration p95 at S=50.

### FE-002

**Role:** Senior Frontend Engineer  
**Severity:** Medium  
**File:** `apps/web/src/features/panel/components/panel-shell.tsx:51-55`;
`apps/web/src/app/dashboard/page.tsx:33`; `features/student/components/student-profile.tsx:20`;
`components/layout/site.tsx:27`; `app/test/device-check/page.tsx:18`; `features/tests/components/start-test-link.tsx:12`  
**Function / Endpoint / Component:** identity bootstrap (`GET /users/me`) across shell/pages  
**مشکل:** the same endpoint uses unrelated React Query keys (`panel-me`, `me`, `profile`, `header-me`,
`device-check-me`, `start-test-me`), defeating cache sharing and in-flight deduplication.  
**شواهد:** all listed query functions call exactly `/users/me`; default stale time is 30 seconds
(`providers.tsx:7`). Dashboard mounts PanelShell (`panel-me`) and its own `me`, causing two identity requests
on one route. Public Header uses yet another key.  
**اثر در Production:** at least two requests on dashboard entry, more across navigation, duplicated auth/refresh
work, and inconsistent invalidation (some mutations invalidate only `panel-me` or `profile`).  
**چرا مشکل است:** React Query deduplicates by key, not URL. Different result projections are TypeScript-only;
the server response is the same.  
**راه‌حل دقیق:** define one `currentUserQueryOptions()` with canonical key `['current-user']`, shared response
type and fetcher; derive smaller views with `select`. Invalidate/set this key on login, logout, role/status/profile
mutations.  
**ریسک راه‌حل:** Low-Medium: auth pages use `retry:false`; preserve per-observer retry behavior and clear sensitive
cache on logout/account switch.  
**روش تست:** mount Dashboard+PanelShell with MSW and assert one `/users/me`; test concurrent 401 refresh remains
single-flight; mutation invalidation tests.  
**Benchmark قبل/بعد پیشنهادی:** dashboard identity HTTP requests `2 → 1`; across one 30-second multi-page panel
journey target all current-user reads `N keys → 1 cached key`.

### FE-003

**Role:** Senior Frontend Engineer  
**Severity:** Medium  
**File:** `apps/web/src/app/layout.tsx:9-31`; `apps/web/src/lib/server-locale.ts`; build output  
**Function / Endpoint / Component:** RootLayout and metadata for every route  
**مشکل:** reading request headers in the root layout makes the entire app dynamic, including otherwise static
marketing and payment-status pages.  
**شواهد:** `RootLayout` and `generateMetadata` both call `headers()` for `x-lingospeak-locale`. A production
`next build` in this pass classified every page as `ƒ` dynamic; only `icon.svg` is static. Shared first-load JS
is 103 kB, while `/` is still server-rendered on every request.  
**اثر در Production:** no full-route static cache for homepage/status pages, avoidable server TTFB and compute at
traffic spikes, and a larger failure domain when the web server is under load.  
**چرا مشکل است:** locale routing is deterministic (`/` FA, `/en` EN) but is implemented through a per-request
header at the highest possible boundary.  
**راه‌حل دقیق:** move locale ownership to static route-segment layouts/params (or separate FA/EN layouts) and
generate locale-specific metadata without `headers()` at root. Keep truly live CMS/profile routes dynamic or
use evidence-backed revalidation. Verify middleware behavior and canonical/hreflang output.  
**ریسک راه‌حل:** Medium: URL compatibility, RTL direction, canonical links and duplicated layout composition.  
**روش تست:** build must mark eligible routes `○/●`; Playwright FA/EN dir/lang/canonical tests; cache-header and TTFB test.  
**Benchmark قبل/بعد پیشنهادی:** static-eligible routes currently `0 → homepage + deterministic status/marketing
shells`; compare cold/warm TTFB and server invocations at 100 RPS.

### FE-004

**Role:** Senior Frontend Engineer  
**Severity:** Medium  
**File:** `apps/web/src/app/admin/[section]/page.tsx:1-11`; `dashboard/[section]/page.tsx:1-10`;
`features/panel/components/panel-actions.tsx` (1,757 lines); production build output  
**Function / Endpoint / Component:** dynamic panel section routes  
**مشکل:** every possible section manager is statically imported into one catch-all route; route-level code splitting
cannot exclude unrelated admin/student tools.  
**شواهد:** admin section imports PanelActions, test manager, user manager, examiner manager, ticket manager,
language manager, pricing manager, finance center and calendar before runtime `if/else` selection. Build result:
`/admin/[section]` first-load JS 193 kB, `/dashboard/[section]` 188 kB and `/teacher-panel/[section]` 187 kB,
versus 125–138 kB for panel/home routes. `PanelActions` alone is 1,757 source lines.  
**اثر در Production:** users download/parse code for roles and sections they never open, hurting mobile interaction
readiness and increasing change coupling. Authorization still belongs on the server; hiding chunks is not security.  
**چرا مشکل است:** a catch-all URL does not require a catch-all client bundle. The current component boundary maps
directly to safe lazy-loading units.  
**راه‌حل دقیق:** split PanelActions by domain/section and dynamically import heavy managers with explicit skeletons;
prefer route folders where practical so Next creates per-section chunks. Do not add abstractions around tiny sections.  
**ریسک راه‌حل:** Low-Medium: loading transitions and SSR compatibility for client managers; prefetch the likely
next section on intentional navigation.  
**روش تست:** bundle analyzer/route chunk diff, Playwright each role/section, slow-3G loading state, no hydration warnings.  
**Benchmark قبل/بعد پیشنهادی:** target common panel section first-load near shell baseline (`187–193 kB → <150 kB`)
and keep each heavy manager in its own async chunk; measure JS parse/evaluate time on a mid-tier mobile profile.

### FE-005

**Role:** Senior Frontend Engineer / Product Manager  
**Severity:** Medium  
**File:** `apps/web/src/features/student/components/student-wallet.tsx:9-18,55-112`  
**Function / Endpoint / Component:** Wallet screen tabs  
**مشکل:** balance, 100 transactions and 100 invoices are fetched immediately although only one tab is visible.  
**شواهد:** three `useQuery` calls mount unconditionally at lines 13–15; default tab is `transactions`, but invoices
are still requested and materialized. Backend caps transaction/invoice lists at 100, so this is not unbounded,
but it is an avoidable initial waterfall/load bundle of three concurrent requests.  
**اثر در Production:** every wallet visit pays for invoice data even if the user never opens that tab; DB and JSON
cost roughly doubles the history portion and mobile bandwidth increases.  
**چرا مشکل است:** client caching is already present; query `enabled` and prefetch can align fetch timing with user intent.  
**راه‌حل دقیق:** always fetch balance; enable transactions/invoices only for the active tab, with optional hover/focus
prefetch. Add pagination/load-more rather than permanently exposing only the latest 100 without indicating truncation.  
**ریسک راه‌حل:** Low: first switch can show a skeleton; prefetch can preserve perceived speed.  
**روش تست:** MSW request-count assertion per initial tab and switch; slow-network skeleton; retained cache on tab return.  
**Benchmark قبل/بعد پیشنهادی:** initial wallet requests `3 → 2`; initial history rows transferred `up to 200 → up to 100`.

### PROD-001

**Role:** Product Manager / Senior Frontend Engineer  
**Severity:** High  
**File:** `apps/web/src/features/student/components/student-wallet.tsx:55-108`;
`apps/web/src/lib/wallet-service.ts:81-84`  
**Function / Endpoint / Component:** wallet top-up primary CTA  
**مشکل:** the product presents an enabled, polished “pay and increase balance” flow, but the client implementation
always throws locally because the API does not exist.  
**شواهد:** the form accepts amount/discount and enables the CTA for amount ≥100,000; `topUp()` never makes a
request and unconditionally throws “سرویس افزایش موجودی هنوز ... فعال نشده است.” The TODO explicitly says the
existing POST `/payments` accepts only booking/package references.  
**اثر در Production:** a core money flow is guaranteed to fail for every user after they invest effort entering
data. This damages trust more than a visibly unavailable capability and creates support demand.  
**چرا مشکل است:** this is not a transient error or missing polish; success probability is exactly 0%.  
**راه‌حل دقیق:** product must choose one: implement a server-side WALLET_TOP_UP payment purpose with amount bounds,
idempotency, callback/reconciliation and ledger credit exactly once; or remove/disable the form and clearly mark
the feature unavailable before input. Do not emulate top-up by inventing a fake booking reference.  
**ریسک راه‌حل:** High for backend implementation (financial invariants and fraud surface), Low for honest feature gating.  
**روش تست:** E2E request→gateway→callback→single ledger credit, duplicate callback/idempotency and failure recovery;
or UI test proving no actionable CTA when disabled.  
**Benchmark قبل/بعد پیشنهادی:** current completion rate `0%`; first benchmark funnel `wallet view → CTA → gateway start
→ verified credit`, plus duplicate-credit rate target `0`.

### UX-001

**Role:** Senior UI/UX Designer / Product Manager  
**Severity:** Medium  
**File:** `apps/web/src/app/teachers/[id]/page.tsx:14-19`; `apps/web/src/app/[slug]/page.tsx:24-39`;
no `loading.tsx`, `error.tsx`, or `not-found.tsx` under `apps/web/src/app`  
**Function / Endpoint / Component:** public teacher profile and CMS journeys  
**مشکل:** network/server failures are converted to “not found”, and there are no route-level recovery/loading boundaries.  
**شواهد:** teacher profile catches every exception from `/teachers/:id` and calls `notFound()`. CMS `load()` catches
every error to null and also calls `notFound()`. Repository search finds zero route boundary files. Therefore a
503/timeout and a genuine 404 have the same user outcome, with no retry.  
**اثر در Production:** during a partial API outage, valid teacher and policy/contact pages appear nonexistent;
users cannot distinguish retryable failure from removed content, harming discovery/booking and support access.  
**چرا مشکل است:** error recovery depends on error class/status, not on whether a promise rejected.  
**راه‌حل دقیق:** map only API 404 to `notFound`; rethrow 5xx/network errors into localized `error.tsx` with retry and
request ID. Add route-group `loading.tsx` skeletons sized to final layouts to avoid layout shift.  
**ریسک راه‌حل:** Low-Medium: ensure expected unpublished CMS pages remain 404 and do not leak backend details.  
**روش تست:** Playwright/API mocks for 404, 503 and timeout; assert distinct content, retry and stable layout dimensions.  
**Benchmark قبل/بعد پیشنهادی:** recoverable failures offering retry `0% → 100%`; CLS target `<0.1`; track retry-success rate.

### UX-002

**Role:** Senior UI/UX Designer / Product Manager  
**Severity:** Medium  
**File:** `apps/web/src/features/student/components/student-wallet.tsx:9-108`  
**Function / Endpoint / Component:** wallet top-up feedback  
**مشکل:** the submit button has no pending label/progress semantics and remains textually “پرداخت و افزایش موجودی”
while disabled; failure is only shown after a guaranteed local rejection.  
**شواهد:** `disabled={amount < 100000 || pay.isPending}` changes only interactivity, not label, `aria-busy`, or next
step; no recovery guidance appears beyond the raw error box.  
**اثر در Production:** if top-up is implemented, gateway-start latency is perceived as a frozen control and repeated
intent is likely; today the flow leads users into a dead end.  
**چرا مشکل است:** money actions need explicit state and outcome feedback; optimistic wallet credit would be unsafe
before gateway verification.  
**راه‌حل دقیق:** first gate/implement `PROD-001`; then show pending text/spinner, disable inputs, preserve idempotency
key across retries, explain redirect and ambiguous failure recovery. Never optimistically increase wallet balance.  
**ریسک راه‌حل:** Low for feedback; correctness risk if optimistic financial state is introduced (do not).  
**روش تست:** slow gateway mock, double-click, retry with same idempotency key, screen-reader announcement.  
**Benchmark قبل/بعد پیشنهادی:** duplicate gateway-start attempts per user action target `≤1`; measure abandonment during
gateway-start latency and recovery completion.

### ARCH-301

**Role:** Staff / Senior Software Engineer  
**Severity:** Medium  
**File:** `apps/web/src/features/panel/components/panel-actions.tsx` (1,757 lines);
`apps/api/src/modules/assessment/tests.service.ts` (866 lines)  
**Function / Endpoint / Component:** multi-domain panel mutations; assessment authoring/attempt/review workflows  
**مشکل:** two change hotspots combine unrelated workflows, causing bundle coupling on web and transactional/test
coupling on API. This is actionable pressure, not a line-count-only refactor request.  
**شواهد:** PanelActions is imported by student, teacher and admin catch-all routes and contains query/mutation/upload
logic for many sections. TestsService spans public definitions, attempt lifecycle, autosave, scoring, examiner queue,
review finalization and admin builder operations; its controller already exposes three distinct personas. The build
cost of the web coupling is measured in `FE-004`; BE-004 demonstrates an autosave boundary hidden inside the service.  
**اثر در Production:** unrelated changes invalidate/reload shared chunks, ownership is unclear, and focused testing
or scaling of assessment review vs autosave is difficult.  
**چرا مشکل است:** cohesion is low at already-observed independent change axes; splitting by arbitrary helper size
would be cosmetic, but splitting by use case matches routes and tests.  
**راه‌حل دقیق:** split PanelActions into section-owned components loaded by route; split TestsService incrementally
into attempt/autosave, review/scoring, and definition-builder application services while keeping one AssessmentModule
and shared domain helpers. Preserve transaction boundaries and avoid repository interfaces with only one implementation.  
**ریسک راه‌حل:** Medium-High for backend transaction/DI movement; Low-Medium frontend. Execute only alongside a
real change such as BE-004/FE-004, not as a standalone rewrite.  
**روش تست:** existing assessment workflow suites, architecture import tests, contract/E2E parity, per-route bundle diff.  
**Benchmark قبل/بعد پیشنهادی:** affected route chunk sizes from FE-004; service test setup dependency count and
changed-files blast radius per use case before/after.

### DESIGN-001

**Role:** Product / Visual Designer / Senior UI/UX Designer  
**Severity:** Medium  
**File:** `apps/web/src/features/student/components/student-wallet.tsx:20-190`;
`apps/web/src/features/panel/components/panel-shell.tsx:48-151`  
**Function / Endpoint / Component:** English/RTL panel experience  
**مشکل:** the shell is bilingual, but the wallet screen is hard-coded Persian throughout, including labels,
errors, currency helper and empty states.  
**شواهد:** PanelShell derives `fa` from locale and supplies English labels; StudentWallet never reads locale and
all visible strings are Persian. It uses `lib/format.ts`'s Persian-only `toman()` instead of the bilingual money
design token/API.  
**اثر در Production:** an English user entering `/en/dashboard/wallet` gets an English shell surrounding a Persian
financial task, mixed directionality and inconsistent numerals; this increases error risk in a high-trust flow.  
**چرا مشکل است:** localization is part of component variants/design-system consistency, not decorative polish for
payments. It also enabled the money-unit regression by allowing multiple formatting systems.  
**راه‌حل دقیق:** route every wallet string through the existing locale layer; use centralized `formatMoney` and
logical CSS properties; define bilingual variants for status, empty, error and pending states.  
**ریسک راه‌حل:** Low; translation accuracy for financial terminology needs product review.  
**روش تست:** visual snapshots FA/EN at mobile/desktop; assert `dir`, numerals and no Persian text in EN fixture;
keyboard/screen-reader pass.  
**Benchmark قبل/بعد پیشنهادی:** untranslated wallet strings `>20 → 0`; visual-regression matrix `2 locales × 2 breakpoints`.

## 3. INVESTIGATED — NO CHANGE REQUIRED

### INV-01 — Prisma includes are not re-filed as N+1

Prior live instrumentation measured fixed statement counts per included relation (for example 34 roles/121
role-permission rows in four statements). Current code still uses Prisma 6.19.3 without preview join loading.
No evidence supports a global JOIN switch; it can multiply child rows and memory. Pagination/select improvements
in BE-002/003 address the actual unbounded work.

### INV-02 — Matching availability batching remains correct

`AvailabilityService.slotsForCandidates()` still batches overrides, blocked periods and bookings and computes per
candidate in memory. The prior measurement `84 → 5` SQL statements at 12 candidates remains the relevant evidence.
No `Promise.all` change is proposed.

### INV-03 — Wallet transaction/invoice backend reads are bounded

`WalletService.transactions()` and `invoices()` each use `take:100` and narrow invoice `select`. They are not
unbounded backend findings. FE-005 concerns eager client timing and the absence of explicit pagination/truncation UX.

### INV-04 — Support ticket list is paginated

`SupportService.list()` clamps page size to 100 and performs list+count as an array transaction. Nested replies are
limited to one on the list path. The separate legacy `adminTickets()` is capped at 200. No generic index/cache
recommendation is justified here.

### INV-05 — Do not cache financial/authorization/availability state

Wallet, payments, payouts, permissions, per-user identity and booking slots have correctness/security-sensitive
freshness. Redis availability is not justification. The prior CACHE OPTIONAL classification remains limited to
measured public, low-staleness reads after traffic evidence exists.

### INV-06 — Sequential work inside interactive transactions is not blindly parallelized

Booking, refund, withdrawal and assessment finalization transactions have state-dependent reads/writes. Prisma
interactive transactions use one connection, so `Promise.all` does not create safe database parallelism and can
obscure ordering. This audit proposes set-based work only where semantics are explicit (BE-004/005) and concurrency
only for independent reads outside a transaction (BE-002).

### INV-07 — Current production bundle is not globally catastrophic

Measured build shared first-load JS is 103 kB and public route totals are 121–163 kB. The evidence-backed outliers
are the catch-all panel sections at 187–193 kB; therefore FE-004 is scoped to those routes rather than recommending
a generic dependency purge.

## 4. Product-flow priority map

| Flow | Direct findings | Priority rationale |
|---|---|---|
| Payment / Wallet | `FE-001`, `BE-001`, `FE-005`, `PROD-001`, `UX-002`, `DESIGN-001` | trust/correctness and guaranteed top-up failure; highest business impact |
| Teacher discovery / Matching | `FE-001`, `BE-003`, `FE-003`, `UX-001` | public acquisition, SEO/TTFB and valid pages misreported as missing |
| Booking | `FE-001`, `BE-001` | price truth and gateway availability; previous slot-query bottleneck already fixed |
| Dashboard | `BE-002/003`, `FE-002/004/005`, `ARCH-301` | repeated requests, lifetime histories, JS cost |
| Support | `BE-005` | customer reply latency grows with staff size |
| Admin | `FE-004`, `ARCH-301` | role-specific tools share a large catch-all bundle |
| Signup/Login | `FE-002`; inherited `PERF-309` | identity fetch dedupe is low-risk; async OTP still needs product decision |
| Search | prior `PERF-301/304` fixes | no new evidence-backed P0/P1 issue in this pass |

## 5. MASTER BACKLOG

### P0 — immediate production blockers

1. `FE-001`: eliminate regressed IRR/Toman mislabelling on every purchase/finance surface.
2. `PROD-001`: feature-gate wallet top-up or implement the complete idempotent financial workflow before launch.
3. `BE-001`: bound Zarinpal calls and make ambiguous timeout recovery observable.
4. Inherited open security work: `SEC-201`, `SEC-202`, and production RBAC seed decision `RBAC-001` before using seeded roles outside local demo.

### P1 — important performance/scalability

1. `BE-002`: paginate teacher finance lifetime data.
2. `BE-003`: paginate matching/test histories and split list/detail projections.
3. `BE-004`: bound/validate autosave arrays and control O(N) transactional writes.
4. `FE-002`: canonical current-user query key.
5. `FE-004`: split catch-all panel bundles by section.
6. `BE-005`: set-based support notification fan-out if production staff cardinality confirms impact.
7. `LOAD-001` + `PERF-308`: production-build load test and real connection-budget exercise.

### P2 — code quality / architecture / UX

1. `UX-001`: distinguish 404 from transient API failure and add route recovery/loading boundaries.
2. `FE-003`: remove root request-header dependency from static-eligible routes.
3. `FE-005`: fetch wallet tab data on demand and expose pagination/truncation.
4. `ARCH-301`: split hotspots only while delivering BE-004/FE-004.
5. `DESIGN-001`: complete bilingual wallet variants and centralized money rendering.
6. Inherited `SEC-211`, `TEST-001`, `FIN-103`, `AUD-001`.

### P3 — polish / evidence-dependent

1. `UX-002`: precise pending/recovery feedback after the top-up product decision.
2. `PERF-310/311`: only after production traffic/hit-rate and freshness/CDN policy justify it.
3. `PERF-307/309/313`: retain prior deferred/no-action decisions until required external evidence exists.
4. Complete `MIG-001` only with backup, migration rehearsal and formatter/fixture gates described in the financial audit.

## 6. TOP 10 HIGHEST ROI IMPROVEMENTS

1. Replace all ten regressed money renderers with the already-tested shared formatter and add a forbidden-literal gate.
2. Hide/disable wallet top-up now unless the idempotent backend flow is ready.
3. Add measured, configurable Zarinpal deadlines plus latency/outcome metrics.
4. Reuse one React Query key/options factory for `/users/me`.
5. Add cursor pagination to teacher earnings/payouts with a compact first page.
6. Add cursor pagination and compact list projections to matching and test histories.
7. Add nested DTO validation, uniqueness and a real maximum to exam autosave payloads.
8. Dynamically split admin/student/teacher section managers; start with the 1,757-line PanelActions dependency.
9. Treat only true 404s as not-found and provide localized retry boundaries for transient failures.
10. Make wallet data tab-driven (`balance + active tab`) and localize it through the existing design/money APIs.

## 7. Verification and benchmark plan

The current web production build passes. The read-only regression gate also passes: API 44 suites / 299 tests,
Web 7 suites / 24 tests. Measured output used by this report: shared first-load JS 103 kB;
`/admin/[section]` 193 kB, `/dashboard/[section]` 188 kB, `/teacher-panel/[section]` 187 kB; every route was
classified dynamic. Absolute DB latency claims were deliberately not invented because the local dataset is small.

Recommended production-shaped gate after P0/P1 implementation:

1. Seed cardinalities: 100k users, 10k teachers, 10k lifetime earnings for a heavy teacher, 1k matching sessions
   with five recommendations, 1k test attempts, 50 support agents.
2. Capture Prisma query count, rows, JSON bytes, Node heap delta and serialization time per affected endpoint.
3. Run `EXPLAIN (ANALYZE, BUFFERS)` for the exact paginated query shapes after representative statistics are loaded;
   do not infer index value from the tiny development database.
4. Load-test production builds at target concurrency while recording p50/p95/p99, pool wait, active DB connections,
   event-loop delay, provider timeouts, error rate and queue backlog.
5. Web: Lighthouse/Web Vitals on mid-tier mobile for homepage, teachers, checkout and all three panel catch-all
   routes; record LCP, INP, CLS, transferred JS and request count.
