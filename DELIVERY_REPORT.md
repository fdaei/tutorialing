# LingoSpeak V7 delivery report

Date: 2026-07-19

## Completed workflows

- Database-backed educational languages with dynamic public/admin selectors and Persian/English UI separation.
- Language-specific placement tests, test builder CRUD, audio persistence, objective auto-scoring, subjective examiner queue, claim/review states, bilingual feedback, final score recalculation, result notification, and learner resubmission for `NEEDS_REVISION` answers.
- Examiner queue tabs now separate `APPROVED` from `NEEDS_REVISION`; a reviewed answer no longer remains in the pending queue.
- Weekly teacher availability, date exceptions, blocked periods, Jalali date/time inputs, timezone-safe UTC persistence, local-date slot generation, immediate list refresh, public-slot cache invalidation, block deletion, and backend booking rejection.
- Compact seven-day booking/checkout UI, trial/regular prices and durations, server-side slot recheck, Redis lock, and serializable booking transaction.
- Teacher application, documents, intro video, teaching languages, price proposal/counter/final approval, history/audit, public profile metrics, review eligibility/moderation, and teacher replies.
- Ticket author identity/direction/message type, status and assignment history, notifications, searchable filters, and assigned-to-me views.
- Reusable async search select with server-side search, debounce, pagination, keyboard navigation, loading and empty states.
- Standard localized domain errors and a detailed `NO_ELIGIBLE_TEACHER_EARNINGS` payout error. Empty payout batches are no longer created.
- Idempotent development seed for administration, verification, support, finance, examiner, approved/pending teachers, learners, multilingual tests, bookings, earnings, payouts, reviews, tickets, CMS and notifications.
- Public teacher prices remain available while a new proposal is being reviewed; only approved price fields are published and used for booking/matching.
- Future lessons cannot be marked completed before their scheduled end time.

## Database migrations

- `20260714050641_init`
- `20260716120000_add_localized_content`
- `20260719090000_multilanguage_workflows`

## Verification performed in this runtime

- `prisma format`: passed
- `prisma validate`: passed
- `prisma generate`: passed
- TypeScript typecheck for all workspaces: passed
- ESLint: passed with zero warnings
- API unit/workflow tests: 9 suites, 21 tests passed
- Web unit/component tests: 4 suites, 6 tests passed
- API production build: passed
- Next.js compile, type/lint validation and static page generation: passed
- Generated Next.js production artifact: started successfully and returned HTTP 200 for `/`
- Playwright suite discovery: 4 tests found

## Runtime limitation

This execution environment does not provide Docker, PostgreSQL, Redis or MinIO, and ports 5432, 6379 and 9000 are closed. Therefore live `prisma migrate deploy`, seed execution, API integration tests and the database-backed API health check could not be executed here. Playwright navigation is also blocked by the host browser policy (`ERR_BLOCKED_BY_ADMINISTRATOR`), not by an application assertion.

Run the full infrastructure verification on a machine with Docker using the commands in the README.
