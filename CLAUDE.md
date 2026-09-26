# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

LingoSpeak — a multilingual language-learning platform and teacher marketplace. npm workspaces monorepo: Next.js 15 / React 19 web app, NestJS 11 / Prisma API, PostgreSQL, Redis, and MinIO (S3-compatible storage). The README (`README.md`) is written in Persian and is the canonical setup doc; this file summarizes what's needed for code changes.

## Common commands

Run from repo root unless noted. Workspaces: `@lingospeak/web` (`apps/web`), `@lingospeak/api` (`apps/api`), `@lingospeak/contracts` (`packages/contracts`).

```bash
npm run setup            # copy .env.example -> .env / apps/api/.env if missing, npm ci if needed
npm run dev               # web dev server (localhost:3000)
npm run dev:api           # env check + docker services + db prepare + API dev server (localhost:4001)
npm run services:up       # start postgres/redis/minio via docker compose, wait healthy, create bucket
npm run services:down     # stop containers (keeps volumes/data)
npm run db:prepare        # prisma generate + validate + migrate deploy + seed
npm run db:migrate:dev -w @lingospeak/api -- --name <name>   # create a new migration (dev only)
npm run env:check         # validate .env against required vars/JWT length/DATABASE_URL consistency
npm run health:api        # curl API health endpoint, checks DB connectivity

npm run build:contracts   # build packages/contracts (dual ESM+CJS); prerequisite of build/typecheck/test
npm run build              # build all workspaces
npm run typecheck          # tsc --noEmit across workspaces
npm run lint                # eslint across workspaces
npm run test                # unit tests across workspaces
npm run test:e2e            # e2e tests across workspaces (Playwright for web, Jest+Supertest for API)
npm run verify               # db:format + db:validate + typecheck + lint + test + build — full gate
```

Single test, targeted work:

```bash
# API (jest --runInBand, rootDir=src, matches *.spec.ts)
npm run test -w @lingospeak/api -- path/to/file.spec.ts
npm run test -w @lingospeak/api -- -t "test name pattern"

# Web (ts-jest, jsdom, matches *.spec.ts(x) under src/)
npm run test -w @lingospeak/web -- path/to/file.spec.tsx
npm run test -w @lingospeak/web -- -t "test name pattern"

# Web e2e (Playwright, apps/web/e2e/*.spec.ts)
npx playwright test panels.spec.ts -w @lingospeak/web
```

Prisma commands (`apps/api`) must be run from repo root via the `db:*` npm scripts, not `npx prisma` directly, except for one-off dev migrations (`db:migrate:dev`). Never use `prisma db push` — only committed migrations via `prisma migrate deploy`.

## Architecture

### Monorepo layout
- `apps/web` — Next.js App Router frontend.
- `apps/api` — NestJS backend, domain-driven modules under `src/modules/*` (auth, bookings, commerce, users, teachers, learning, matching, admin, files, languages, queue, search, support, tests).
- `packages/contracts` — shared Zod schemas/types (validation schemas, `PACKAGE_TIERS`, `TeacherCard`, etc.) consumed by both `web` and `api` as `@lingospeak/contracts`. Cross-cutting request/response shapes should be added here, not duplicated in each app. It emits dual ESM + CJS (`npm run build:contracts`, two `tsc` passes plus a nested `{"type":"commonjs"}` marker) so the CommonJS API can `require()` it — the root `build`/`typecheck`/`test` scripts build it first, and `dist/` is gitignored. Don't point `main`/`types` back at raw `.ts`: that was the ESM/CJS mismatch that made the package unusable from `apps/api` and forced constants to be copy-pasted per app.

### API structure (`apps/api/src`) — see `ARCHITECTURE.md` for full detail
Each feature module follows: `controllers/` (HTTP + guards only, no Prisma or business logic) → `services/` (business rules, transactions; large services split by responsibility, e.g. `payments.service.ts`, `wallet.service.ts`) → `repositories/` (complex/repeated Prisma queries) → `dto/request/` and `dto/response/` (class-validator input DTOs, class-transformer `@Expose()`-shaped output DTOs) → `mappers/` (Prisma entity → response DTO).

- `src/config/` — centralized config via `@nestjs/config`, namespaced (`appConfig`, `authConfig`, `redisConfig`), validated with Zod in `env.validation.ts` at startup. Inject `ConfigService`; don't read `process.env` directly in services.
- `src/common/` — shared auth/guard infrastructure: decorators (`@CurrentUser()`, `@Public()`, `@Roles()`, `@Permissions()`, `@RateLimit()`), guards (`AccessGuard`, `AuthorizationGuard`, `RateLimitGuard`), `AuthUser` type.
- `src/database` / `prisma.service.ts` — Prisma connectivity.
- Global `ValidationPipe` (`whitelist: true`, `forbidNonWhitelisted: true`) and global exception filters normalize Prisma/app errors into standard API responses (registered in `main.ts`).
- Swagger docs at `/docs` are registered only when `NODE_ENV !== 'production'`.

### Web structure (`apps/web/src`)
- `app/` — App Router pages/routes; `app/en/` mirrors the default (Persian/RTL) routes for the English locale via rewrite, not separate pages logic — see locale handling below.
- `components/` — feature components (flat, not nested by domain); most panel/admin/teacher/student UI lives here rather than being colocated under `app/`.
- `lib/` — `api.ts` (API client), `data.ts`, `i18n.ts`, `panel-access.ts` (route authorization, see below), `wallet-service.ts`, `format.ts`.
- `middleware.ts` — sets locale (`fa` default, `en` via `/en` prefix rewritten to bare path), issues a per-request CSP nonce, and sets a strict `Content-Security-Policy`. `'unsafe-eval'` is added only in development (needed for HMR/webpack eval); production CSP stays strict.

### Locale handling
Default locale is Persian (RTL) served at bare paths; English is served under `/en/*` and rewritten by `middleware.ts` to the same underlying route with `x-lingospeak-locale: en` set. When adding a page, mirror it under `app/en/` if it needs an English variant (see `app/[slug]` vs `app/en/[slug]`).

### Route authorization (`apps/web/src/lib/panel-access.ts`)
`ROUTE_RULES` is an explicit allow-list mapping path patterns to role/permission checks (`isAdmin`, `hasRole`, `hasPermission`); anything unmatched is denied. `safeInternalPath()` guards `?next=` redirect targets against protocol-relative URLs, `..` traversal, and control-character smuggling. **When adding a new panel/admin route, add its rule here** — order matters, since narrower `/admin/*` patterns must precede the catch-all `/admin` rule.

### Web test doubles
Specs that stub the API module do it as `{ ...jest.requireActual('@/shared/services/api'), api: jest.fn() }`, keeping any deliberate overrides after the spread. Enumerating the module's exports by hand is what silently broke `admin-teachers-manager.spec.tsx`: the editor started reading per-field validation errors through `apiField`, the hand-written double did not export it, and the dialog crashed at render instead of failing on an assertion. Spread the real module and stub only what must not hit the network.

### Public discovery (`apps/web/src/app/sitemap.ts`, `robots.ts`)
`sitemap.ts` lists only routes that render for a signed-out visitor, with both locales attached to one entry as hreflang alternates (the canonical stays the Persian path, matching what `publicPageMetadata` emits on the pages). It regenerates hourly (`revalidate = 3600`) and each list call is wrapped so one failing endpoint shortens the sitemap instead of 500-ing it. Two rules to keep in mind when adding a public route: anything matched by `ROUTE_RULES` needs an account and must stay out, and teacher URLs are emitted only when `featureFlags.teacherDiscovery` is on — while it is off, `middleware.ts` 307s `/teachers` to `/courses`, so listing them would advertise redirects. Its dynamic URLs come from two narrow, public, rate-limited endpoints built for it — `GET /blog/posts/slugs` and `GET /support/pages` — each returning published slugs and dates (plus CMS page titles, which the landing footer links with) and never the bodies, since both are anonymous enumerations. Use those rather than the full list endpoints: paging `/blog/posts` pulled every post body just to compute a reading time the crawler feed never shows. `/blog/posts/slugs` is declared before `posts/:slug` in the controller so the literal wins the route match. `robots.ts` disallows each private prefix in both the bare and `/en` spelling, and falls back to `Disallow: /` when `NEXT_PUBLIC_WEB_URL` is still the localhost default, which keeps preview deployments out of the index. Both files sit outside the middleware matcher (it skips paths containing a dot), so they are served unrewritten.

### Auth
Phone + OTP based (no passwords). OTP delivery fails closed: without `AUTH_DEV_OTP=true` the API generates a random code via `crypto.randomInt` and returns 503 if no SMS provider (Kavenegar) is configured; the fixed dev code `123456` only works with that flag, and startup aborts if it's combined with `NODE_ENV=production`. OTP codes are stored as HMAC-SHA256 under a pepper derived from `JWT_ACCESS_SECRET` (a 6-digit code is rainbow-table-able under a bare digest); refresh-token hashing deliberately stays plain SHA-256, since a 32-byte random secret isn't. JWT access/refresh tokens; per-IP rate limiting on auth routes (`RateLimitGuard`, backed by Redis) fails closed (503) if Redis is unreachable. Privilege escalation is blocked at the service layer: `assignRole`/`grantPermission`/`setUserRoles` reject `userId === actorId`.

Access tokens are stateless and carry roles/permissions from issuance time, so **any code path that suspends a user or changes their roles/permissions must call `TokenRevocationService.revokeUser()`** — `AccessGuard` rejects tokens whose `iat` predates that marker, and without the call the old privileges stay usable for up to 15 minutes. The check fails closed for the staff roles in `REVOCATION_CRITICAL_ROLES` (`access-token.guard.ts`: `ADMIN` and `SUPPORT`) and open for `STUDENT`/`INSTRUCTOR`, so a Redis outage can't take down ordinary traffic; a spec fails if a staff role is added to the schema without joining that set. `Role` has only those four values — `ROLE_MANAGEMENT_POLICY.md` explains why the capabilities once described as `FINANCE`/`STAFF`/`EXAMINER` roles live in permissions instead, and what the SEC-207 tier rules are.

### Payments / commerce
Zarinpal integration (sandbox toggled via `ZARINPAL_SANDBOX`); wallet and payout logic split out into dedicated services under `modules/commerce`. Never enable `ZARINPAL_SANDBOX` in production.

`gateway.verify()` captures money before the transaction that grants the entitlement commits, so a crash in between takes the payment without delivering anything. `ReconciliationService` is the repair path: a 10-minute `@Cron` sweep (Redis-locked to one instance) re-verifies stale settleable payments, writes a `Reconciliation` row per discrepancy, and settles through `PaymentsService.settleVerified()` — the same path a real callback uses. Route any new "the gateway says paid but we don't" handling through `settleVerified()` rather than reimplementing fulfilment.

## Security notes worth knowing before touching related code

See `SECURITY.md` for the full accepted-risk register (dependency advisories, why Next 16 hasn't been adopted yet, etc.). Key load-bearing details:
- `postcss` is pinned to `^8.5.24` via root `package.json` `overrides` — after any dependency reinstall, verify with `npm ls postcss` that every copy resolved to the patched version (Next.js bundles its own older copy otherwise).
- The web CSP (`middleware.ts`) is intentionally strict; don't loosen `script-src` without addressing why (token exfiltration via injected scripts is the threat it's blocking).

## Env vars

Full reference is in `README.md`. `apps/api/.env` and root `.env` must stay consistent (same `POSTGRES_*` / `DATABASE_URL` values). `npm run env:check` validates required vars, JWT secret length (≥32 chars), and `DATABASE_URL`/Compose consistency before services start.
