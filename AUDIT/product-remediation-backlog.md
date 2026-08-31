# Product remediation backlog

Last updated: 2026-08-30

This is the live inventory for the autonomous product-wide remediation loop. A route marked
`Not audited` has been discovered, but has not yet passed product, UX, responsive, accessibility,
functional and state review. `Batch done` never means the project is done.

## Route inventory

| Route / area | Access | Status | Current evidence / next check | Priority |
|---|---|---|---|---|
| `/`, `/en` | Public | Audited | Live catalogue, locale-specific copy/cards/links, metadata and production rendering verified; browser execution pending local services | P1 |
| `/[slug]`, `/en/[slug]` | Public | Audited | 404/outage semantics, localized content/navigation, empty content and full social metadata covered; browser execution pending services | P1 |
| `/courses` | Public | Audited | Live language filters, localized loading/empty/error states and full metadata covered | P1 |
| `/courses/[slug]` | Public | Audited with blocker | Localized detail/reviews, 404/outage distinction and metadata covered; enrollment remains blocked by PAY-001 | P1 |
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
| TRUST-001 | Homepage uses fixtures, unsupported platform metrics and named testimonials | Homepage | P1 | Public trust claims contradict live product state | M | Public catalogue APIs | Use live counts/content and remove unsupported claims | Done (batch 13) |
| I18N-001 | `/en` rewrites to a homepage whose product copy is hard-coded in Persian | Homepage | P1 | English visitors receive an LTR document with Persian content | M | Localized landing-page content | Drive all homepage copy and links from the request locale and add browser coverage | Done (batch 15; browser execution pending services) |
| I18N-002 | English CMS pages mixed English body content with Persian chrome and non-localized links | CMS catch-all | P1 | Legal/support journeys changed language and lost `/en`; share metadata was incomplete | S | Existing CMS bilingual fields | Localize page chrome and empty state; use canonical, alternates, Open Graph and Twitter metadata | Done (batch 16; browser execution pending services) |
| I18N-003 | Course discovery/detail and shared review states were Persian-only under `/en` | Courses/reviews | P1 | English learners could not understand filtering, course evidence or review recovery states | M | Existing bilingual course fields | Localize the complete journey, number/date formats, links, loading and errors | Done (batch 17; browser execution pending services) |
| DATA-003 | Course filter options were a static four-language list while the language catalogue supports ten | Course directory | P1 | Published courses in other languages could not be filtered | S | Course catalogue | Derive unique filter values from the live course response and localize display names centrally | Done (batch 17) |
| TRUST-002 | Course purchase card claimed a seven-day refund guarantee and completion certificate with no supporting product contract | Course detail | P1 | Unsupported conversion claims create legal and customer-trust risk | XS | Product policy absent | Remove unsupported claims without changing enrollment/payment behavior | Done (batch 17) |
| UX-002 | Shared error boundaries always rendered Persian recovery UI | Route/feature errors | P1 | Every English outage broke locale consistency | S | Locale provider | Localize safe error copy and retry controls once in the shared boundary | Done (batch 17) |
| TOOL-002 | Typecheck mixed generated `.next` and `.next-dev` route types; local Prisma/dependencies could also be stale | Build tooling | P1 | Clean source appeared to have dozens of type errors and the gate was unusable | S | Generated artifacts and lockfile install | Keep production route types isolated, regenerate Prisma, and verify installed dependencies | Done (batch 14) |
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

- Replaced fixture catalogue, unsupported metrics, fictional personal-state cards and unsourced testimonials.
- Decision: public trust evidence comes only from live catalogue APIs; remove claims that cannot be traced to product data.

### Batch 14 — Restore trustworthy repository gates

- Regenerated the Prisma Client from the current schema and restored the dependency tree from the lockfile.
- Isolated production Next route types from the separate development dist directory, removing cross-artifact type conflicts.
- Removed the nonexistent `community` module from a stale architecture allowlist; the source tree and application graph have never exposed that feature.
- Repository lint, typecheck and production build pass; 110 web tests pass and the repaired architecture suite passes.

### Batch 15 — Complete the English landing journey

- Localized every homepage section, evidence-backed statistic, accessible image description and number format from the request locale.
- Preserved `/en` across homepage CTAs, discovery links, teacher/course cards and article links; localized shared course, article and teacher review states.
- Added desktop/mobile browser coverage for English document language, direction, copy and route continuity.
- Web lint, typecheck, 110 tests and production build pass; Playwright discovers all 34 checks, but execution awaits the local API/database stack.

### Batch 16 — Honest, localized CMS pages

- Preserved English context across breadcrumbs, quick links, supporting copy, contact location and directional icons.
- Added a visible localized state for published pages with no body paragraphs instead of rendering a blank article.
- Reused the shared public metadata builder for canonical URLs, language alternates, Open Graph and Twitter data.
- Kept genuine 404 responses distinct from upstream API failures; web lint, typecheck and production build pass, and Playwright discovers 36 desktop/mobile checks.

### Batch 17 — Complete course discovery and evidence

- Replaced the static four-language filter with values derived from the live course catalogue; a focused domain helper localizes all ten active language names and preserves unknown future values.
- Localized course listing, detail, metadata, review dialog, dates, numbers, loading, errors and deep links without altering enrollment or payment behavior.
- Removed unsupported seven-day-refund and completion-certificate claims from the purchase card.
- Added English unit and browser coverage; web lint, typecheck, 115 tests and production build pass, and Playwright discovers 38 desktop/mobile checks.
