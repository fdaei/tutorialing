# Product remediation backlog

Last updated: 2026-08-30

This is the live inventory for the autonomous product-wide remediation loop. A route marked
`Not audited` has been discovered, but has not yet passed product, UX, responsive, accessibility,
functional and state review. `Batch done` never means the project is done.

## Route inventory

| Route / area | Access | Status | Current evidence / next check | Priority |
|---|---|---|---|---|
| `/`, `/en` | Public | Not audited | Landing journey, locale links, responsive hero, SEO | P1 |
| `/[slug]`, `/en/[slug]` | Public | Not audited | CMS fallback routes, 404 vs API failure, metadata | P1 |
| `/courses` | Public | Needs follow-up | Functional language filter added; API failure still collapses into empty state | P1 |
| `/courses/[slug]` | Public | Not audited | Detail, purchase CTA, missing/API error distinction, metadata | P1 |
| `/teachers` | Public | Not audited | Search/filter/sort/pagination states and mobile sticky controls | P1 |
| `/teachers/[id]` | Public | Not audited | Booking journey, media fallback, metadata | P1 |
| `/languages`, `/languages/[slug]` | Public | Not audited | Static/API data consistency and intent-specific CTA | P1 |
| `/blog`, `/blog/[slug]` | Public | Not audited | Search race/debounce, unsafe `any`, SEO and article conversion | P1 |
| `/teach`, `/teach/register`, `/teacher-apply` | Mixed | Not audited | Duplicated application entry points and form recovery | P1 |
| `/auth`, `/login`, `/register`, `/verify-code` | Public | Not audited | Activation flow, redirect safety, validation and recovery | P1 |
| `/forgot-password`, `/reset-password` | Public | Not audited | Reset flow and error states | P1 |
| `/placement` | Public/mixed | Not audited | Test state, refresh/recovery, responsive/keyboard | P1 |
| `/matching` | Authenticated | Not audited | Matching flow and API states | P1 |
| `/checkout` | Authenticated | Not audited | Payment-critical UX; no contract changes without approval | P1 |
| `/payment/success`, `/failure`, `/pending` | Public callback | Not audited | Refresh, trust, status reconciliation | P1 |
| `/payment/development` | Development | Not audited | Production exclusion and simulator safety | P2 |
| `/panel`, `/dashboard`, `/dashboard/[section]` | Authenticated | Not audited | Redirect/access model and student workspace states | P1 |
| `/teacher-panel`, `/teacher-panel/[section]` | Teacher | Not audited | Access model, navigation, workflows, responsive tables | P1 |
| `/admin`, `/admin/[section]` | Admin/staff | Not audited | Permission-aware navigation and destructive actions | P1 |
| `/test/device-check`, `/test/session` | Authenticated | Not audited | Device permissions, persistence, failure recovery | P1 |

## Cross-product backlog

| ID | Problem / root cause | Location | Priority | Impact | Effort | Dependency / risk | Recommended solution | Status |
|---|---|---|---|---|---|---|---|---|
| PROD-001 | Course filters looked interactive but were inert | `/courses` | P1 | Discovery and trust | S | None | Accessible client-side filtering with result/empty states | Done (batch 1) |
| DISC-001 | Teacher text search only runs on Enter and filters have no unified reset | `/teachers` | P1 | Search is undiscoverable on mobile; recovery is slow | S | None | Add explicit submit and one reset action | Done (batch 9) |
| MEDIA-001 | Teacher intro-video control has no behavior or public media authorization path | Teacher profile/API | P1 | Broken trust signal and dead interaction | M | Private object storage | Add narrowly authorized signed URL endpoint and accessible player dialog | Done (batch 10) |
| CONV-001 | Guest visitors see no booking card or CTA on teacher profiles | Teacher booking card | P1 | Primary conversion path disappears before sign-in | S | Preserve checkout destination through auth | Render price/CTA for guests with safe `next`, plus loading/unpriced states | Done (batch 10) |
| TOOL-001 | Next build does not detect the Next.js ESLint plugin | Web lint config | P2 | Framework-specific mistakes can pass lint | S | ESLint 9 flat-config compatibility | Extend the supported Next flat presets without losing hook rules | Done (batch 11) |
| DATA-002 | Language catalogue and detail use four static records and fabricated course counts | `/languages` ecosystem | P1 | Public discovery contradicts live catalogue of ten languages | M | Public language/course APIs | Render real languages and courses; preserve legacy URLs | Done (batch 12) |
| TRUST-001 | Homepage uses fixtures, unsupported platform metrics and named testimonials | Homepage | P1 | Public trust claims contradict live product state | M | Public catalogue APIs | Use live counts/content and remove unsupported claims | In progress (batch 13) |
| PAY-001 | Course CTA has no purchase/enrollment flow and returns to the same page after auth | Course detail/API | P1 | Misleading dead-end conversion | L | Product/payment decision and new financial workflow | Define course purchase entitlement before implementation | Blocked by payment/business approval |
| PAY-002 | Teacher checkout redirects to payment success immediately after booking creation | Checkout/payment flow | P0 | UI can claim payment success without creating/verifying payment | L | Payment behavior; requires explicit approval | Design and implement booking→payment→gateway→verified result flow | Blocked by payment approval |
| ARCH-001 | Architecture gate expected an obsolete commerce public surface | API architecture test | P1 | Full test gate red; false regression signal | XS | Confirm consumers use barrel | Update exact allowlist to the four intentional exports | Done (batch 2) |
| DATA-001 | API failures are converted to empty/not-found states | Course/CMS/detail server pages | P1 | Outages mislead users and hide incidents | M | Shared server/client retry design | Preserve error vs empty vs 404 semantics | Done (batch 3) |
| SEO-001 | Only root and CMS catch-all routes define metadata | Most public routes | P1 | Weak search/share previews and duplicate canonicals | M | Locale-aware metadata | Add route-level metadata, then structured data where justified | In progress (batch 5) |
| QA-001 | Playwright browser cache is missing although system Chromium exists | E2E config/tooling | P1 | Browser QA gate unavailable | S | Environment portability | Support an explicit executable path or provision Playwright browser | Done (batch 6) |
| DS-001 | Two overlapping token systems and loose colour literals | `globals.css`, components | P2 | Visual drift and maintenance cost | L | Incremental migration | Alias semantic tokens, migrate high-traffic screens | Ready |
| UX-001 | Shared header lacks current-page state and mobile menu semantics | Site header | P2 | Orientation and keyboard/mobile UX | M | All public pages | Add active state, expanded/control semantics and escape behavior | Done (batch 8) |
| PERF-001 | Blog search requests on every keystroke and can resolve out of order | `/blog` | P1 | Waste, flicker and stale results | M | Typed blog contract | Debounce/cancel requests and remove `any` | Done (batch 4) |
| SEC-201 | Prisma CLI/config dependency has 3 linked high advisories | Dependency tree | P1 | Build-time stack exhaustion risk; no runtime path found | L | Prisma major upgrade is breaking and needs approval | Upgrade Prisma in a separately approved migration batch | Blocked by breaking-change approval |
| SEC-202 | Upload MIME is client-declared | File service | P2 | Arbitrary stored content type | M | File signature library/policy | Content sniffing with allowlist and tests | Ready |
| EXT-001 | Successful real payment path needs human/provider interaction | Payment flow | P1 | Final financial proof incomplete | — | External credential/action | Keep blocked; validate all non-provider branches meanwhile | Blocked externally |

## Batch log

### Batch 1 — Course discovery interaction

- Replaced inert language chips with keyboard-accessible filters.
- Added selected state, live result count and guided no-results recovery.
- Added component coverage; web lint, typecheck, 105 tests and production build passed.
- Browser run was blocked by the missing Playwright-managed Chromium binary; `QA-001` remains open.

### Batch 2 — Restore trustworthy architecture gate

- Root cause: `BookingsService` intentionally consumes `WalletService` and `AutoDiscountsService`
  through the commerce public barrel, but the exact-export architecture test still described the
  earlier two-export surface.
- Decision: keep the valid module boundary and update the exact allowlist; do not reintroduce deep
  imports merely to satisfy a stale assertion.
- Validation: 408 API tests, API lint, typecheck and build all pass.

### Batch 3 — Honest course loading and failure states

- In progress: separate a genuine empty course catalogue and a genuine 404 from API/network failure.
- Add route-level loading and retryable error UI shared by course list and details.

### Batch 4 — Deterministic blog search

- In progress: debounce search input, cancel superseded requests and replace untyped list data.
- Distinguish initial loading, refresh, API error, no published content and no search results.

### Batch 5 — Public discovery metadata

- In progress: add a shared locale-aware metadata builder for course, teacher, language and blog discovery.
- Canonical, language alternates, Open Graph and Twitter summaries derive from the same route-specific copy.

### Batch 6 — Portable browser QA

- Added an explicit Chromium executable override without changing the default Playwright-managed browser behavior.
- Browser QA exposed and fixed an ambiguous phone label containing both the country select and phone input.
- The phone input now has an explicit label plus error association; all 4 desktop/mobile public checks pass.

### Batch 7 — Current production dependency audit

- `npm audit --omit=dev` now reports 3 high findings, all one chain: Prisma 6.19.3 → `@prisma/config` → `deepmerge-ts` 7.1.5.
- No runtime import path was found; the affected package is Prisma configuration tooling.
- The available remediation requires a breaking Prisma major upgrade, so it is isolated pending explicit approval rather than silently applied.

### Batch 8 — Shared navigation orientation

- Desktop and mobile links expose the current route, including detail pages and `/en` routes.
- The mobile trigger exposes expanded/controlled state, and Escape closes the menu.
- Pure route matching has regression coverage; browser coverage is pending the batch gate.

### Batch 9 — Teacher discovery controls

- Added a visible search submit action and one reset for query, language, skill, rating, sort and pagination.
- Web lint, typecheck and 108 tests pass; all 4 desktop/mobile public browser checks pass.

### Batch 10 — Teacher introduction video

- Added a rate-limited public endpoint that signs only a SAFE canonical intro video belonging to an APPROVED teacher.
- Replaced the inert control with a native dialog, real media controls, loading, error and retry states.
- Restored the guest conversion path: price and sign-in-to-book CTA remain visible and preserve checkout destination.
- Full repository gates pass: 410 API tests, 110 web tests, lint, typecheck and production build.

### Batch 11 — Restore Next.js lint coverage

- Loaded the official Core Web Vitals and TypeScript presets through the ESLint 9 compatibility layer.
- Fixed newly exposed `prefer-const` and unescaped-content errors; scoped exceptions cover runtime signed media and CommonJS test mocks.
- Web lint, typecheck, 110 tests and build pass; the Next plugin warning is gone.

### Batch 12 — Live language discovery

- Replaced the four-record static catalogue and fabricated counts with the ten active API languages.
- Language detail now uses live language/course data, preserves four legacy slugs and has honest no-course guidance.
- Web lint, typecheck, 110 tests and production build pass; `/languages` initial JS fell from 169KB to 163KB.

### Batch 13 — Evidence-based homepage

- In progress: replace fixture catalogue, unsupported metrics, fictional personal-state cards and unsourced testimonials.
- Decision: public trust evidence comes only from live catalogue APIs; remove claims that cannot be traced to product data.
