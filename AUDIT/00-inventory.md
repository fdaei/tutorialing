# Phase 0 — Inventory

> **Scope correction.** The audit brief describes "a NestJS backend and Vue 3 frontend" with a
> document store (Mongoose-style: collections, `populate`, `$where`). That is **not** this repo.
> This repo is NestJS 11 + **Next.js 15 / React 19** + **Prisma 6 / PostgreSQL 16**.
> Every later phase is re-mapped onto the actual stack: "collection" → table/model,
> `populate` → Prisma `include`/`select`, `$where`/`$ne` injection → Prisma operator injection
> and raw SQL. Where a brief item has no analogue (e.g. `allowDiskUse`, sharding ceiling) it is
> answered with the PostgreSQL equivalent, and marked as such.

## 0.1 Repo layout

npm **workspaces** monorepo (`package.json:3-6`), package manager **npm** (`package-lock.json`
present, lockfileVersion from npm; no pnpm/yarn lockfile). Node `>=20` (`package.json:38-40`).

| Root | Workspace name | Role |
| --- | --- | --- |
| `apps/api` | `@lingospeak/api` | NestJS 11 backend, Prisma, port 4001 |
| `apps/web` | `@lingospeak/web` | Next.js 15 App Router frontend, port 3000 |
| `packages/contracts` | `@lingospeak/contracts` | Shared Zod schemas — 43 lines total |

No Nx/Turborepo/Lerna. Orchestration is plain npm scripts in the root `package.json`.

Backend source: 191 `.ts` files, 21 controllers, 34 services (`apps/api/src`).
Frontend source: 24 App Router pages, 32 components, ~2,800 total lines (`apps/web/src`).

## 0.2 Runtime and framework versions

Read from the three `package.json` files, not the README.

| Component | Version | Source |
| --- | --- | --- |
| NestJS (`common`/`core`/`platform-express`) | `^11.0.0` | `apps/api/package.json:18-24` |
| `@nestjs/jwt` | `^11.0.0` | `apps/api/package.json:21` |
| `@nestjs/schedule` | `^6.1.3` | `apps/api/package.json:22` |
| `@nestjs/swagger` | `^11.0.0` | `apps/api/package.json:23` |
| Prisma client + CLI | `^6.3.1` | `apps/api/package.json:24`, `:47` |
| BullMQ | `^5.40.3` | `apps/api/package.json:25` |
| ioredis | `^5.4.2` | `apps/api/package.json:33` |
| `@aws-sdk/client-s3` | `^3.744.0` | `apps/api/package.json:16` |
| Zod | `^3.24.2` | `apps/api/package.json:36` |
| Next.js | `^15.1.7` | `apps/web/package.json:17` |
| React / React DOM | `^19.0.0` | `apps/web/package.json:18-19` |
| TanStack React Query | `^5.66.0` | `apps/web/package.json:15` |
| react-hook-form | `^7.54.2` | `apps/web/package.json:20` |
| Tailwind | `^3.4.17` | `apps/web/package.json:37` |
| TypeScript | `^5.7.3` | all three |

**No Vue anywhere.** **No Mongoose/TypeORM.** **No `@nestjs/config`** — see 0.5.

## 0.3 Database engine — confirmed from connection config

**PostgreSQL 16**, confirmed at two independent points, not from the README:

- `apps/api/prisma/schema.prisma:5-8` — `datasource db { provider = "postgresql"; url = env("DATABASE_URL") }`
- `docker-compose.yml:2-17` — `image: postgres:16-alpine`, healthcheck `pg_isready`

Schema: **1,272 lines, 63 models, 22 enums** (`apps/api/prisma/schema.prisma`).
Migrations are committed and applied with `prisma migrate deploy` (`apps/api/package.json:43`);
11 migration directories exist, `20260714050641_init` → `20260801120000_withdrawal_idempotency_key`.

`apps/api/prisma/schema.prisma.bak` is committed alongside the live schema — a stale duplicate
that will drift silently. → **F-005**.

## 0.4 Infrastructure actually touched

| Concern | Technology | Evidence |
| --- | --- | --- |
| Relational DB | PostgreSQL 16 | `schema.prisma:5-8`; `docker-compose.yml:3` |
| Cache / locks / rate limit | Redis 7 (ioredis) | `docker-compose.yml:18-26`; `common/core/services/redis.service.ts` |
| Job queue | BullMQ, single queue `notifications` | `modules/queue/queue.service.ts:41` (`new Queue('notifications')`), `:46` (`new Worker`) |
| Scheduler | `@nestjs/schedule`, **exactly one** cron | `modules/commerce/payments/reconciliation.service.ts:63` — `@Cron(CronExpression.EVERY_10_MINUTES)` |
| Object storage | MinIO (S3 API) + presigned URLs | `docker-compose.yml:27-45`; `@aws-sdk/s3-request-presigner` |
| SMS | Kavenegar `verify/lookup` template API | `modules/auth/sms.service.ts:7`; `modules/queue/queue.service.ts:65`; `modules/support/support.service.ts:194` |
| Payment gateway | Zarinpal PG v4 | `modules/commerce/payments/gateway.service.ts:25` (request), `:45` (verify) |
| Message bus | **none** | no NATS/Kafka/RabbitMQ in any `package.json` |
| Mail | **none** | no mail client dependency; notifications are IN_APP + SMS only (`NotificationChannel`, `schema.prisma:116-119`) |

All three external providers are called with bare `fetch()` and **no timeout and no retry** at the
call site — see Phase 1 for the failure-mode trace. Three separate hand-rolled Kavenegar call sites
duplicate the same URL construction (`sms.service.ts:7`, `queue.service.ts:65`,
`support.service.ts:194`) rather than sharing one client. → **F-006**.

## 0.5 Configuration mechanism

**The documented mechanism does not exist.** `CLAUDE.md` states config is "centralized config via
`@nestjs/config`, namespaced (`appConfig`, `authConfig`, `redisConfig`) … Inject `ConfigService`".

Actual implementation:

- `@nestjs/config` is **not a dependency** of `apps/api` (`apps/api/package.json:15-36`).
- `apps/api/src/config/index.ts:1-9` — a module-level singleton function `config()` that lazily
  parses `process.env` through Zod and memoises the result in `cachedConfig`.
- `apps/api/src/config/config.module.ts:1-9` — an empty `@Module({})` whose constructor calls
  `config()` purely for its startup side effect. It provides and exports nothing.
- `apps/api/src/env.ts:1-15` — dotenv loader that probes `apps/api/.env` then root `.env` with
  `override: false`.

There is no `ConfigService`, no namespace, no DI. Consumers import `config()` directly (17 call
sites). The pattern is functional and validated, but the guidance in `CLAUDE.md` is wrong and
would send a contributor to a non-existent API. → **F-001**.

Validation itself is sound: `apps/api/src/config/env.validation.ts:3-37` (shape) and `:39-72`
(production guards that abort startup on `AUTH_DEV_OTP`, missing `ZARINPAL_MERCHANT_ID`,
`ZARINPAL_SANDBOX`, missing `KAVENEGAR_API_KEY`).

## 0.6 Environment variables consumed

Consumed set is exactly the 17 keys in `env.validation.ts:3-37`. Usage counts exclude
`*.spec.ts` and `env.validation.ts` itself.

| Name | Where used | Safe default | In `.env.example` | Notes |
| --- | --- | --- | --- | --- |
| `NODE_ENV` | `main.ts:27`, guards | `development` | ✅ | gates Swagger + prod guards |
| `PORT` | `main.ts:31` | `4001` | ✅ | |
| `DATABASE_URL` | Prisma only (`schema.prisma:7`) | none (required, `.url()`) | ✅ | 0 refs in TS — correct, Prisma reads it |
| `REDIS_URL` | `redis.service.ts`, `queue.service.ts` | `redis://localhost:6379` | ✅ | |
| `JWT_ACCESS_SECRET` | `app.module.ts:2`, OTP pepper | none, `min(32)` | ✅ | doubles as HMAC pepper for OTP hashes |
| `JWT_REFRESH_SECRET` | **nowhere** | none, `min(32)` | ✅ | **dead — see F-002** |
| `API_URL` | gateway callback URL | `http://localhost:4001` | ✅ | |
| `WEB_URL` | `main.ts:21` CORS origin, redirects | `http://localhost:3000` | ✅ | |
| `S3_ENDPOINT` | `files.service.ts` | `http://localhost:9000` | ✅ | |
| `S3_ACCESS_KEY` | `files.service.ts` | none, `min(1)` | ✅ | |
| `S3_SECRET_KEY` | `files.service.ts` | none, `min(1)` | ✅ | |
| `S3_BUCKET` | `files.service.ts` (4×) | none, `min(1)` | ✅ | |
| `KAVENEGAR_API_KEY` | 3 SMS call sites (6 refs) | optional → dev adapter | ✅ | prod guard `env.validation.ts:65-71` |
| `ZARINPAL_MERCHANT_ID` | `gateway.service.ts` | optional → dev adapter | ✅ | prod guard `:51-57` |
| `ZARINPAL_SANDBOX` | `gateway.service.ts` | `false` | ✅ | prod guard `:58-64` |
| `AUTH_DEV_OTP` | `auth.service.ts` (3 refs) | `false` | ✅ | prod guard `:40-46` |
| `TRUST_PROXY` | `main.ts:19` | `0` | ✅ | must match proxy depth or per-IP limits break |

Frontend consumes 4 (`apps/web/src`, `grep process.env`): `NEXT_PUBLIC_API_URL` (×2),
`NEXT_PUBLIC_WEB_URL`, `NEXT_PUBLIC_ENAMAD_HTML`, `NODE_ENV`. All 4 are documented.

`POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` appear in `.env.example` and are consumed by
`docker-compose.yml:6-8` only, never by the API — correct, since the API uses `DATABASE_URL`.

**Documentation coverage is complete**: every consumed variable is present in `.env.example`, with
a genuinely useful comment block on the four dangerous ones (`.env.example:17-45`). This is better
than typical.

### F-002 — `JWT_REFRESH_SECRET` is required but never used

`grep -rn "REFRESH_SECRET" apps/api/src` returns only `env.validation.ts:9`. Refresh tokens are
**not JWTs**: `auth.service.ts:28` mints an opaque `${sessionId}.${randomBytes(32).base64url}`
pair and stores `hash(refreshSecret)` in `RefreshSession.tokenHash`; `auth.service.ts:29`
validates by comparing `hash(secret)` against that column. No signing key participates.

Impact is operational, not exploitable: an operator who rotates `JWT_REFRESH_SECRET` during an
incident will believe every refresh token is invalidated. Nothing changes — sessions remain valid
until their `RefreshSession` rows are revoked. The variable is also enforced as `min(32)` at
startup, which reinforces the false belief that it is load-bearing. Severity **low**.

## 0.7 Test surface

**API** — Jest + ts-jest, `rootDir: src`, `testRegex: .*\.spec\.ts$`, `--runInBand`
(`apps/api/package.json:59-70`).

Verified by execution: `npm run test -w @lingospeak/api` → **30 suites passed, 174 tests passed,
0 failed, 13.8 s**. The suite runs clean.

30 spec files, all colocated in `src/`. Coverage is concentrated where it matters — the money and
concurrency paths carry dedicated suites:

- Concurrency/integrity: `bookings/bookings.concurrency.spec.ts`, `bookings/availability.service.spec.ts`,
  `bookings/booking-rules.spec.ts`, `bookings/refund-tiers.spec.ts`,
  `commerce/discounts/discount-reservation.spec.ts`
- Money: `commerce/payments/{payments,gateway,reconciliation,refunds}.service.spec.ts`,
  `commerce/payouts/{earnings,payouts}.service.spec.ts`
- Auth/authz: `auth/auth.service.spec.ts`, `common/core/guards/{access-token,authorization,rate-limit}.guard.spec.ts`
- Infra: `config/env.validation.spec.ts`, `common/core/services/redis.service.spec.ts`,
  `common/core/filters/api-exception.filter.spec.ts`

These are **unit tests with mocked Prisma**, not integration tests against a live database. That
distinction is decisive for Phase 6: a mocked client cannot demonstrate that a unique constraint,
a transaction isolation level, or an `updateMany` guard actually holds under concurrent writes.
`bookings.concurrency.spec.ts` therefore tests the *intent* of the concurrency guard, not the
guard. → tracked as **F-003**, assessed in Phase 6.

**API e2e** — `apps/api/test/platform.e2e-spec.ts` with `test/jest-e2e.json`. One file. Requires
live Postgres + Redis; **not run** in this audit (would mutate the developer database).
`UNVERIFIED:` its pass state — needs `npm run services:up && npm run test:e2e -w @lingospeak/api`.

**Web** — Jest + jsdom, 6 unit specs: `lib/{api,data,i18n,panel-access}.spec.ts`,
`components/{async-search-select,jalali-date-time-picker}.spec.tsx`. `panel-access.spec.ts` (67
lines) covering the route allow-list is the highest-value one. 26 of 32 components untested.

**Web e2e** — Playwright, `apps/web/e2e/{panels,public}.spec.ts`. Not run (needs both servers up).

## 0.8 Frontend ↔ backend contract (first look; detailed in Phase 1)

`packages/contracts` exists to be the shared source of truth but is **43 lines** and imported at
only **4 call sites** total:

- `apps/api/.../packages.dto.ts:2` and `packages.service.ts:3` — `PACKAGE_TIERS`
- `apps/web/src/app/matching/page.tsx:6` — `matchingSchema`
- `apps/web/src/components/panel-actions.tsx:7` — `PACKAGE_TIERS`

Everything else is **hand-copied**. `apps/web/src/lib/api.ts:44-49` declares `EducationalLanguage`,
`TeacherLanguage`, `PublicTeacher`, `Paginated<T>`, `ItemsPage<T>` as standalone TypeScript types
with no derivation from, and no compile-time link to, the API's response DTOs. `PublicTeacher`
duplicates ~25 fields of the Prisma `Teacher` model. Nothing detects drift.

Two competing pagination envelopes coexist in that same file — `Paginated<T>`
(`{data,total,page,totalPages}`) and `ItemsPage<T>` (`{items,pagination:{…}}`) —
`apps/web/src/lib/api.ts:48-49`. → **F-004**, detailed in Phase 1.

Auth transport: access token in `sessionStorage`, refresh token in an HTTP-only cookie
(`credentials:'include'`), with a shared in-flight refresh promise to avoid rotation-induced
family revocation (`apps/web/src/lib/api.ts:8-38`). The `sessionStorage` choice is assessed in
Phase 7.

## 0.9 Code-shape observation

Large parts of the backend are committed **minified onto single lines** — whole modules with no
line breaks:

| File | Longest line (chars) |
| --- | --- |
| `apps/api/src/modules/learning/learning.service.ts` | 2,172 |
| `apps/api/src/modules/auth/auth.controller.ts` | 1,403 |
| `apps/api/src/modules/auth/auth.service.ts` | 1,303 |
| `apps/api/src/app.module.ts` | 1,265 |
| `apps/api/src/modules/tests/tests.service.ts` | 1,152 |
| `apps/api/src/modules/queue/queue.service.ts` | 842 |
| `apps/api/src/modules/users/users.service.ts` | 750 |

This is hand-written source, not build output — the files sit in `src/` and carry prose comments.
It defeats line-level review, `git blame`, and stack-trace-to-line mapping, and it is why several
later findings cite a line number that contains an entire service method. → **F-007**.

## 0.10 Domains

Derived from `apps/api/src/modules/*` cross-referenced against model ownership in
`schema.prisma`. 16 domains; these drive every later phase.

| # | Domain | Module path | Owned models |
| --- | --- | --- | --- |
| 1 | `auth-identity` | `modules/auth` | User(auth cols), OtpChallenge, RefreshSession, UserRole, RolePermission, Permission |
| 2 | `users` | `modules/users` | User(profile cols), NotificationPreference |
| 3 | `teachers` | `modules/teachers` | Teacher, VerificationItem, VerificationHistory, TeacherPriceHistory |
| 4 | `reviews` | `modules/teachers/reviews.*` | Review, Favorite |
| 5 | `availability` | `modules/bookings/availability.*` | AvailabilityRule, AvailabilityOverride, BlockedPeriod, CancellationPolicy |
| 6 | `bookings` | `modules/bookings` | Booking, ClassRecord, Reminder |
| 7 | `payments` | `modules/commerce/payments` | Payment, Refund, Reconciliation, WalletEntry, Discount, DiscountRule |
| 8 | `packages` | `modules/commerce/packages` | Package, Enrollment, CreditEntry, PackageRecommendation |
| 9 | `payouts` | `modules/commerce/payouts` | Earning, PayoutBatch, PayoutItem, WithdrawalRequest |
| 10 | `assessment` | `modules/tests` | TestDefinition, TestSection, Passage, Question, TestAttempt, AttemptSectionState, TestAnswer, TestScore, ExaminerReview |
| 11 | `matching` | `modules/matching` | MatchingSession, MatchingRecommendation |
| 12 | `learning` | `modules/learning` | LearningPlan, Milestone, Assignment, TrialEvaluation |
| 13 | `support` | `modules/support` | Ticket, TicketReply, TicketStatusHistory, TicketAssignmentHistory, Notification, NotificationDelivery |
| 14 | `files` | `modules/files` | StoredFile |
| 15 | `languages` | `modules/languages` | Language, TeacherLanguage, LocalizedContent |
| 16 | `admin` | `modules/admin` | CmsPage, Setting, AuditLog |

`modules/search` and `modules/queue` own no tables — `search` reads `teachers`/`languages`,
`queue` reads `bookings`/`support`. They are treated as cross-cutting, not domains.

## Phase 0 findings

| ID | Sev | Title | Evidence |
| --- | --- | --- | --- |
| F-001 | low | `CLAUDE.md` documents a `@nestjs/config` + `ConfigService` setup that does not exist; real mechanism is a `config()` singleton | `config/index.ts:1-9` vs `CLAUDE.md`; `@nestjs/config` absent from `apps/api/package.json` |
| F-002 | low | `JWT_REFRESH_SECRET` required at startup, referenced nowhere; refresh tokens are opaque DB-hashed strings. Rotating it invalidates nothing | `env.validation.ts:9`; `auth.service.ts:28-29` |
| F-003 | medium | Concurrency/money suites mock Prisma, so DB-level guarantees (unique constraints, tx isolation) are asserted but never exercised | `bookings/bookings.concurrency.spec.ts`; no integration DB in `apps/api/package.json:59-70` |
| F-004 | medium | Frontend response types hand-copied from backend DTOs with no shared derivation; two rival pagination envelopes | `apps/web/src/lib/api.ts:44-49`; `packages/contracts/src/index.ts` (43 lines, 4 importers) |
| F-005 | low | `prisma/schema.prisma.bak` committed next to the live schema | `apps/api/prisma/schema.prisma.bak` |
| F-006 | low | Kavenegar URL construction duplicated at 3 call sites instead of one client | `auth/sms.service.ts:7`; `queue/queue.service.ts:65`; `support/support.service.ts:194` |
| F-007 | medium | Backend source committed minified (lines up to 2,172 chars), defeating review, blame, and stack traces | `learning/learning.service.ts`; `auth/auth.service.ts`; `app.module.ts` |
