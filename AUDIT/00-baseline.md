# Phase 0 — Baseline (read-only)

**Date:** 2026-08-08
**Working copy:** `/home/fdaei/project/my/tutorialing` (the prompt named
`~/Downloads/LingoSpeak-Pro-RTL (11)/lingospeak-pro`; this is a different checkout of the
same project — `CLAUDE.md` and the git history confirm it is LingoSpeak).
**Commit at baseline:** `ebdb499`, working tree clean.

No code was changed in this phase.

---

## 0.1 Prior audit history — read this first

This repository has **already been audited twice**, and that materially changes what is left to do.

| Pass | Commits | What it did |
|---|---|---|
| First audit | `6577651` … `3f27e45`, report in `62d6c15` | Full 7-phase run. 26 findings (FIN/SEC/RATE/STR), 19 fixed. |
| Follow-up | `36dede1` | Closed the remaining 7: reconciliation job, token revocation, withdrawal idempotency, dual ESM/CJS contracts, OTP pepper, `P2034` retry. |
| Restructure | `3b04c00` | Large folder move: `common/*` → `common/core/*`, `commerce/*` split into `discounts/ packages/ payments/ payouts/`. |
| Schema docs | `ebdb499` | Replaced the audit deliverables with a different, schema-oriented doc set. |

**Finding AUD-001 (MEDIUM, process).** Commit `3b04c00` **deleted** the entire first audit's
evidence base — `00-map.md`, `01-security.md`, `02-financial.md`, `03-structure.md`,
`04-ratelimit.md`, `05-load.md`, `REPORT.md`, `npm-audit.json` — and `ebdb499` replaced them with
an unrelated schema-documentation set under the same `0X-` numbering. The *code* fixes survive
(they are ancestors of HEAD), but the record of what was found, what was deliberately accepted,
and what remained open was destroyed. Anyone reading `AUDIT/` at `ebdb499` would conclude no
security or financial audit had ever been performed.

Recovered to scratchpad via `git show 3b04c00^:AUDIT/<file>` and used as input to this pass.
The prior report's own summary: **26 fixed, 2 wontfix, 1 open (LOAD-001, a capacity
measurement).**

*Consequence for this audit:* claims in that report are **stale** — they predate the `3b04c00`
restructure. Every one is re-verified here rather than inherited.

---

## 0.2 Stack and layout

npm workspaces monorepo, Node 22.17.1 / npm 10.9.2, `engines: node >=20`.

| Workspace | Path | Stack |
|---|---|---|
| `@lingospeak/api` | `apps/api` | NestJS 11, Prisma 6 / PostgreSQL 16, Redis, BullMQ, MinIO (S3) |
| `@lingospeak/web` | `apps/web` | Next.js 15 App Router, React 19, Tailwind, TanStack Query |
| `@lingospeak/contracts` | `packages/contracts` | Shared Zod schemas, dual ESM+CJS build |

**Source volume:** API 191 `.ts` (30 spec files); web 74 `.ts`/`.tsx` (6 spec files) + 2 Playwright
e2e specs.

**API modules** (`apps/api/src/modules/`): admin, auth, bookings, commerce, files, languages,
learning, matching, queue, search, support, teachers, tests, users.

**Entry points:** `apps/api/src/main.ts` (port 4001), `apps/web` Next dev server (port 3000),
`docker-compose.yml` → postgres / redis / minio / minio-init / lingospeak.

---

## 0.3 Baseline gate results — measured, not inherited

Run at `ebdb499` on a clean tree. Full log: scratchpad `baseline.log`.

| Gate | Command | Result |
|---|---|---|
| Typecheck | `npm run typecheck` | **PASS** (exit 0) |
| Lint | `npm run lint` | **PASS** (exit 0, `--max-warnings=0`) |
| Test | `npm run test` | **PASS** — API 174/174 (30 suites), web 19/19 (6 suites) = **193** |
| Build | `npm run build` | **PASS** (exit 0) |

All four gates are green. This matches the prior report's post-follow-up claim of 193 passing,
so the `3b04c00` restructure did not regress the suite.

**Not run at baseline:** `npm run test:e2e` (Playwright, needs a running stack),
`npm audit`, load suite. Deferred to Phase 4/6.

---

## 0.4 Can the app boot?

**Not currently running.** Docker 29.5.2 is installed and the daemon is up. The three project
containers exist but are stopped:

```
tutorialing-postgres-1   Exited (0) 31 hours ago
tutorialing-redis-1      Exited (0) 31 hours ago
tutorialing-minio-1      Exited (0) 31 hours ago
```

Startup path is scripted: `npm run services:up` → `npm run db:prepare` → `npm run dev:api`.
Booting is deferred to Phase 6 (live verification) rather than done here, because Phase 0 is
read-only and starting containers mutates local state. **VERIFIED: NO** — the app has not been
observed running in this session.

**Env drift (LOW).** `.env` is missing two keys present in `.env.example`: `TRUST_PROXY` and
`NEXT_PUBLIC_ENAMAD_HTML`. `TRUST_PROXY` governs per-IP rate-limit accuracy behind a proxy;
absent locally it defaults safely, but it must be set per-deployment.

---

## 0.5 Data model summary

Prisma schema is ~1,200 lines. Domains: auth/identity, users, teachers, availability, bookings,
packages, payments, payouts, reviews, learning, matching, assessment (IELTS-style tests),
support, files, languages, admin.

**Money representation — the single most important fact.**

Every money-bearing column in `schema.prisma` is `Int`:

```
price, credits, discountPercent, creditsPurchased, amount, subtotal, discountAmount,
walletAmount, grossAmount, commissionAmount, netAmount, totalAmount
```

**There is no `Float` or `Decimal` on any money field.** The `Float` columns that exist
(`rating`, `targetBands`, `currentBand`, `score`, `points`, `overallBand`, `autoScore`,
`finalScore`, `autoBand`, `aiBand`, `finalBand`, `band`) are all IELTS band scores and review
ratings — legitimate non-monetary use.

**Canonical unit: Toman**, stated at `apps/api/src/modules/commerce/payments/gateway.service.ts:5-8`:

> All LingoSpeak prices and ledger entries are stored in toman, while Zarinpal v4 accepts and
> verifies amounts in rial. Keep the conversion at this provider boundary so the rest of the
> finance domain stays in one unit.

Conversion is a single function, `toRial = (toman) => toman * 10` (line 8), applied at exactly
two call sites — `request()` line 25 and `verify()` line 45. Symmetric, so the gateway compares
like with like. **This design is correct.**

**Multi-language is already modelled.** `Language` (code, nameFa, nameEn, nativeName, flag,
`direction` LTR/RTL, `proficiencySystem` CEFR, active, order) and `TeacherLanguage`
(teacher × language × levels[] × specialties[], PK `[teacherId, languageId]`). Target language is
first-class reference data, not hardcoded.

---

## 0.6 Money-touching code paths

Every path where value is created, moved, or destroyed:

| # | Path | Files |
|---|---|---|
| 1 | Checkout → gateway redirect | `commerce/payments/payments.service.ts`, `gateway.service.ts` |
| 2 | Gateway callback → verify → settle | `payments.service.ts` (`callback`, `settleVerified`) |
| 3 | Reconciliation sweep (10-min cron) | `payments/reconciliation.service.ts` |
| 4 | Refunds | `payments/refunds.service.ts` |
| 5 | Wallet debit/credit | `payments/wallet.service.ts` |
| 6 | Package purchase / credit grant | `commerce/packages/packages.service.ts` |
| 7 | Discounts + reservation | `commerce/discounts/{discounts,auto-discounts,discount-reservation}.service.ts` |
| 8 | Teacher earnings + commission split | `commerce/payouts/earnings.service.ts` |
| 9 | Withdrawal request → payout | `commerce/payouts/payouts.service.ts` |
| 10 | Booking price derivation | `bookings/bookings.service.ts`, `availability.service.ts` |
| 11 | Teacher price proposal/approval | `teachers/pricing.controller.ts`, `TeacherPriceHistory` |
| 12 | Admin financial actions | `admin/admin.controller.ts` (22 `@Permissions` routes) |

---

## 0.7 Route and authorization inventory

**143 routes across 21 controllers.** Guard model: global `AccessGuard` (JWT) +
`AuthorizationGuard` (`@Roles` / `@Permissions`) + `RateLimitGuard`, with `@Public()` opting out
of auth.

| Controller | Routes | `@Public` | `@Roles` | `@Permissions` | `@RateLimit` |
|---|---|---|---|---|---|
| `/admin` | 23 | 0 | 1 | 22 | 9 |
| `/tests` | 26 | 1 | 2 | 1 | 5 |
| `/availability` | 9 | 1 | 8 | 0 | 0 |
| `/bookings` | 9 | 0 | 3 | 0 | **0** |
| `/support` | 8 | 2 | 2 | 2 | 0 |
| `/payments` | 7 | 1 | 1 | 1 | 4 |
| `/teachers` | 6 | 2 | 1 | 0 | 0 |
| `/users/me` | 6 | 0 | **0** | **0** | 0 |
| `/auth` | 5 | 5 | 0 | 0 | 4 |
| `/packages` | 5 | 1 | 3 | 0 | 0 |
| `/payouts` | 5 | 0 | 1 | 1 | 1 |
| `/languages` | 5 | 1 | 1 | 1 | 0 |
| `/learning` | 5 | 0 | 3 | 0 | 0 |
| `/teacher/pricing` | 5 | 0 | 2 | 1 | 0 |
| `/files` | 4 | 0 | **0** | **0** | 3 |
| `/reviews` | 4 | 0 | 2 | 1 | 0 |
| `/` (verification) | 4 | 0 | 4 | 1 | 0 |
| `/matching` | 2 | 0 | **0** | **0** | 0 |
| `/notifications` | 2 | 0 | **0** | **0** | 0 |
| `/teacher/finance` | 2 | 0 | 1 | 0 | 1 |
| `/search` | 1 | 0 | 1 | 0 | 1 |

Bolded zeros are **authenticated-but-unscoped** — any logged-in user reaches them. That is
correct for `/users/me` (self-scoped by `@CurrentUser`) but needs per-route confirmation for
`/files`, `/matching`, `/notifications`. Carried into Phase 2 as the route × role matrix.

`/bookings` has **9 routes and no rate limiting** — carried into Phase 2.

---

## 0.8 Web app surface

**24 App Router pages.** Only **2** exist under `app/en/` (`page.tsx`, `[slug]/page.tsx`) — the
rest are served to both locales via the `middleware.ts` rewrite (`/en/x` → `/x` with an
`x-lingospeak-locale: en` header), with components branching on `fa ? … : …` inline.

**i18n:** `apps/web/src/lib/i18n.ts` — a single flat `messages` object with **~20 keys total**.
There are no `locales/` or `messages/` directories and no i18n library. The overwhelming
majority of user-facing text is inline ternaries in components.

**Direction handling is mostly logical already.** A grep for physical-direction Tailwind
utilities (`ml-`, `mr-`, `pl-`, `pr-`, `left-`, `right-`, `text-left`, `text-right`, `border-l`,
`border-r`) returns only ~20 genuine occurrences across 74 files; the codebase predominantly uses
`ms-`/`me-`/`ps-`/`pe-`/`start-`/`end-`. RTL is largely structural, not patched.

---

## 0.9 Carried into Phase 1 — one confirmed defect already

**FIN-101 (HIGH, pre-filed).** The web app labels the same integer as **Toman in `fa`** and
**IRR (Rial) in `en`**. Since storage is Toman, every price shown to an English-locale user is
understated **10×**.

Evidence — the pattern `fa ? ' تومان' : ' IRR'` appears at:

- `apps/web/src/lib/i18n.ts:37` — `formatMoney(..., { currency: 'IRR' })`
- `apps/web/src/app/checkout/page.tsx:43`
- `apps/web/src/app/matching/page.tsx:25`
- `apps/web/src/app/teachers/[id]/page.tsx:2`
- `apps/web/src/components/teacher-card.tsx:9`
- `apps/web/src/components/teacher-dashboard.tsx:24`
- `apps/web/src/components/teacher-finance.tsx:25`
- `apps/web/src/components/admin-finance-center.tsx:100`
- `apps/web/src/components/admin-users-manager.tsx:48`
- `apps/web/src/components/pricing-manager.tsx:14`
- `apps/web/src/components/resource-view.tsx:52`
- `apps/web/src/components/panel-actions.tsx:128`

Worst instance — the withdrawal form at `teacher-finance.tsx:29` labels the input
`Amount (IRR)` and warns `Minimum withdrawal is 100,000 IRR`, while the value posted is Toman. A
teacher on the English UI believes they are withdrawing 100,000 rial (10,000 toman) and actually
withdraws 100,000 toman.

Two aggravating factors:

1. `formatMoney` in `i18n.ts` is **dead code** — referenced only by its own spec. All 11 other
   sites hand-roll their own formatter. Prompt 2's "never format numbers inline in a component"
   rule is violated 11 times over.
2. The existing test `i18n.spec.ts:14-15` asserts only digit grouping, never the currency label,
   so the bug is invisible to the suite.

Full reproduction, impact and fix go in `AUDIT/01-financial.md`. Not fixed in Phase 0.

---

## 0.10 State of the world

- Gates: **4/4 green**, 193 tests passing.
- App boot: **not verified** this session.
- Findings open at end of Phase 0: **AUD-001** (medium, process), **FIN-101** (high, pre-filed).
- Inherited open item: **LOAD-001** (medium, capacity measurement — not a code defect).
