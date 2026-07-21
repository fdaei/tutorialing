# LingoSpeak

## Development setup

1. Run `npm run setup`. It creates missing `.env` and `apps/api/.env` files from `.env.example` without overwriting existing files, and runs `npm ci` only when dependencies are missing.
2. Run `npm run dev:api`. It repeats the safe setup check, validates the environment, starts healthy PostgreSQL/Redis/MinIO services, initializes the private bucket, runs Prisma `generate`, `validate`, `migrate`, and the idempotent seed, then starts NestJS.
4. In another terminal run `npm run dev` for the web application.
5. Verify the API and database with `npm run health:api`.

Useful commands:

- `npm run services:status` — view Docker service health.
- `npm run db:prepare` — generate, validate, migrate, then seed in the required order.
- `npm run typecheck && npm run build` — verify all workspaces.
- `npm run services:down` — stop local services.

The deprecation notice for `package.json#prisma` is a warning only; migration, connection, validation, seed, build, or health failures are blocking errors.

LingoSpeak is a Persian/English RTL-first marketplace for verified teachers across dynamic educational languages, including English, German, Spanish, Turkish, French, Italian, Portuguese, Korean, Arabic and Russian. It is an npm-workspaces monorepo containing a Next.js web application, NestJS REST API, PostgreSQL/Prisma database, Redis/BullMQ jobs and S3-compatible file storage.

## Applications

- `apps/web`: Next.js App Router UI, Tailwind, TanStack Query, React Hook Form, Zod and Playwright.
- `apps/api`: NestJS modular monolith, Swagger, JWT/OTP authentication, RBAC, Prisma, BullMQ and external-provider adapters.
- `packages/contracts`: shared validation and domain types.

Implemented API domains include authentication/sessions, users/roles/permissions, teachers/verification, files, IELTS tests/scoring/review, matching, availability/bookings/classes, packages/enrollments/credits, learning plans/assignments, payments/wallet/refunds, earnings/payouts, notifications/queues, tickets, CMS/settings and audit logs.

## Setup

```bash
npm run setup
npm run dev:api
npm run dev
npm run health:api
```

Web: `http://localhost:3000`  
API: `http://localhost:4000/api`  
Swagger: `http://localhost:4000/docs`  
MinIO console: `http://localhost:9001`  
Role-aware panel entry: `http://localhost:3000/panel`  
Administration panel: `http://localhost:3000/admin`

Development OTP is `123456`. The seeded administrator phone is `09120000000`; after OTP verification it opens `/admin` automatically. The seed output does not print credentials or tokens. Kavenegar, Zarinpal, S3 and subjective-scoring development adapters execute through backend services and persist requests/results. Configure real provider credentials in production.

`npm run dev:api` performs environment validation, service health checks, Prisma generate/validate/migrate/seed and only then starts NestJS. For a production build, use `npm run start:api` so the same database preparation order is enforced before `node dist/src/main.js`.

If an older installation reports that `Teacher`, `OtpChallenge` or `RefreshSession` does not exist, run the following once with the same `DATABASE_URL` used by the API:

```bash
npm run db:setup
```

The Persian website lives at `/` and the full English experience lives at `/en`. The language switcher preserves the current page and changes `dir`, fonts, labels, CMS content, teacher content, placement-test content and panel actions together.

The administration panel includes connected user creation/status management, paginated user detail and role editing, teacher verification, bookings, finance, CMS/settings and a bilingual test builder. The simplified test builder creates the four standard IELTS sections automatically and lets administrators add questions one at a time. Every published test requires all four skills and bilingual prompts. User-facing forms never ask for database IDs: assignments, students, bookings, teachers, payments and users are selected by names and contextual details while IDs remain internal.

Speaking recordings support WebM, MP4/M4A, OGG, MP3 and WAV browser output. The UI reports success only after the object upload is verified and the file is attached to the test answer in PostgreSQL. Failed uploads retain the local recording for retry, and saved recordings can be replayed after resuming an attempt.

Local MinIO CORS is configured globally with `MINIO_API_CORS_ALLOW_ORIGIN`, while the initializer only creates the private bucket. This avoids failures from unsupported bucket-level CORS operations. In production, set `WEB_URL` to the real frontend origin.


## Development seed accounts

All seeded users use development OTP `123456` when `SMS_PROVIDER=development`:

| Role | Phone |
| --- | --- |
| Administrator | `09120000000` |
| Teacher verifier | `09120000010` |
| Support specialist | `09120000011` |
| Finance specialist | `09120000012` |
| Test examiner | `09120000013` |
| Approved English teacher | `09120000001` |
| Approved German teacher | `09120000002` |
| Pending teacher | `09120000004` |
| Learner with completed activity | `09121111111` |
| Learner with a future booking | `09121111112` |
| Learner with a ticket | `09121111113` |

These are local development identities only. No production secret, token or password is stored in the repository.

## Verification

```bash
npm run db:format
npm run db:validate
npm run typecheck
npm run lint
npm run test
npm run test:e2e
npm run build
```

The API E2E suite uses local PostgreSQL and Redis. Playwright is configured for `/usr/bin/chromium` because its CDN can be unavailable in some regions.

## Security and financial invariants

- OTP expiry, resend cooldown, attempt limits and hourly throttling are server-enforced.
- Refresh tokens rotate in session families; reuse revokes the family.
- Only approved teachers are public, and verification transitions are audited.
- Booking uses a Redis lock plus transactional overlap revalidation.
- Cancellation policy JSON is snapshotted on every booking.
- Prices, discounts, wallet funds and refunds are calculated by the API.
- Wallet balances derive exclusively from immutable ledger entries.
- Gateway callbacks are verified and idempotent.
- Package credits use immutable purchase/reserve/consume/restore entries.
- Writing and Speaking remain under review until examiner approval.
- Uploads require allow-listed MIME types, size limits, SHA-256 metadata and signed URLs.
- Placement results are never represented as official IELTS certificates.
# tutorialing
