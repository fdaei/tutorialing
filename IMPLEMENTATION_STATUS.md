# LingoSpeak Implementation Status

Last updated: 2026-07-19, after multilingual workflow migration, examiner revision fixes, timezone-safe availability, price publication safeguards, payout validation and verification runs.

Legend: `[complete]` implemented with NestJS endpoint, Prisma persistence, authorization/state handling and tests where applicable. `[partial]` usable but missing one or more required behaviours/tests/states. `[missing]` not implemented. `[dev-adapter]` real interface with development provider fallback when credentials are absent.

## Public And Auth

| Surface | UI action/form | API endpoint | Persistence | Auth/RBAC | Tests | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Home `/`, `/en` | Teacher cards, matching/test CTAs | `GET /teachers`, CMS pages | `Teacher`, `CmsPage` | Public approved teachers only | Playwright public smoke | [partial] |
| Teacher directory `/teachers` | Search, skill, sort, pagination, trial CTA | `GET /teachers` | `Teacher`, `Package`, `Review` | Public approved teachers only | Playwright public smoke | [partial] |
| Teacher profile `/teachers/:id` | Trial checkout CTA | `GET /teachers/:slug` | `Teacher`, `Review`, `Package`, policy | Public approved teachers only | Playwright public smoke | [partial] |
| Matching `/matching` | Questionnaire submit | `POST /matching`, `GET /matching/history` | `MatchingSession`, `MatchingRecommendation` | JWT student | API e2e | [complete] |
| Placement landing `/placement` | Start after auth CTA | `GET /tests` | `TestDefinition` | Public metadata | Playwright public smoke | [partial] |
| Auth `/auth` | OTP request, resend, verify | `POST /auth/otp/request`, `/resend`, `/verify`, `/refresh`, `/logout` | `OtpChallenge`, `User`, `RefreshSession` | Public, rate-limited service checks | Unit + API e2e | [complete] |
| CMS pages `/:slug`, `/en/:slug` | Read legal/support content | `GET /support/pages/:slug` | `CmsPage` | Public | Not directly covered | [partial] |
| Checkout `/checkout` | Slot select, policy acknowledgement, payment | `GET /availability/:teacherId/slots`, `POST /bookings`, `POST /payments`, `POST /payments/:id/gateway` | `Booking`, `Payment`, `WalletEntry`, `Notification` | JWT student | API e2e booking | [partial] |
| Payment result pages | Development callback action | `GET /payments/callback` | `Payment`, `Booking`, `Enrollment`, ledger | Public callback, idempotent authority | API e2e covers idempotency and failed wallet rollback | [complete] |

## IELTS Test UX

| Surface | UI action/form | API endpoint | Persistence | Auth/RBAC | Tests | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Device check `/test/device-check` | Mic/network check, start attempt | `GET /tests`, `POST /tests/attempts` | `TestAttempt`, `TestSectionAttempt` | JWT student | API e2e | [complete] |
| Test session `/test/session` | Autosave, objective answers, Writing, Speaking recording upload, section lock, final submit | `GET /tests/attempts/:id`, `PATCH /answers`, `POST /sections/:sectionId/submit`, `POST /submit`, file upload endpoints | `TestAnswer`, `StoredFile`, `TestAttempt` | JWT owner | API e2e | [partial] |
| Examiner queue | Human scoring and approval | `GET /examiner/tests/queue`, `POST /examiner/tests/review` | `TestAttempt`, `TestAnswer`, audit | `EXAMINER`/`ADMIN` | Unit scoring + API e2e | [partial] |
| Admin test builder | Test/section/question CRUD | `GET/POST/PATCH /admin/tests`, `POST /admin/tests/:id/sections`, `POST /admin/tests/sections/:id/questions` | `TestDefinition`, `TestSection`, `TestQuestion` | `ADMIN/STAFF` + `tests.manage` | Not enough UI/E2E | [partial] |

## Student Panel

| Surface | UI action/form | API endpoint | Persistence | Auth/RBAC | Tests | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Dashboard `/dashboard` | View next class, result, wallet metrics | `/users/me`, `/bookings/me`, `/tests/attempts/history`, `/payments/wallet` | Multiple | JWT student | Web unit smoke | [complete] |
| Classes/tests/matches/plan/wallet/tickets/profile sections | Read resource lists plus working profile, ticket and assignment submission forms | Varies by section | Multiple | JWT + role guard | Limited | [partial] |
| Tickets | Create/reply | `POST /support/tickets`, `POST /support/tickets/:id/replies` | `Ticket`, `TicketReply`, files | JWT | API e2e | [complete] |
| Favorites | Add/remove/list | `GET/PUT/DELETE /users/me/favorites/:teacherId` | `Favorite` | JWT | Not covered | [partial] |
| Profile/settings | Update name/email/locale/timezone | `PUT /users/me` | `User` | JWT owner | API auth e2e covers protected profile read; UI mutation typechecked | [partial] |

## Teacher Panel

| Surface | UI action/form | API endpoint | Persistence | Auth/RBAC | Tests | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Dashboard `/teacher-panel` | View today/classes/finance | `/bookings/me`, `/teacher/finance`, `/users/me` | Booking/Earning/User | `TEACHER` | Limited | [partial] |
| Application/profile | Create/update/submit application | `POST/PATCH /teacher/application`, `POST /teacher/application/submit` | `Teacher`, `VerificationHistory` | `TEACHER`/student-upgrade path | UI typecheck; missing e2e | [partial] |
| Verification docs/video | Upload docs/video and attach | `/files/uploads`, `/files/:id/complete`, `/teacher/application/documents`, `/teacher/profile/intro-video` | `StoredFile`, `VerificationItem`, `Teacher` | `TEACHER` owner | UI typecheck; missing browser upload e2e | [partial] |
| Availability | Weekly rules, overrides, blocks | `PUT /availability/me/rules`, `POST /availability/me/overrides`, `/blocks` | `AvailabilityRule`, `AvailabilityOverride`, `BlockedPeriod` | `TEACHER` owner | API e2e overlap | [partial] |
| Trial evaluation/plans/packages | Create evaluation, plan, assignments, packages | `POST /learning/*`, `POST /packages` | `LearningPlan`, `Assignment`, `Package` | `TEACHER` owner | Not enough UI/E2E | [partial] |
| Earnings | Summary and payout history | `GET /teacher/finance` | `Earning`, `PayoutBatch`, `PayoutItem` | `TEACHER` owner | Not enough | [partial] |

## Admin Panel

| Surface | UI action/form | API endpoint | Persistence | Auth/RBAC | Tests | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Dashboard | Metrics | `GET /admin/dashboard` | Multiple | `ADMIN/STAFF` | Not enough | [partial] |
| Users | Read users/status | `GET /admin/users` | `User` | `users.read` | Not enough | [partial] |
| Teacher applications | Transition teacher status, review docs | `GET /admin/teacher-applications`, `POST /transition`, `POST /admin/verification-items/:id/review` | `Teacher`, `VerificationItem`, history | `teachers.verify` | Not enough UI/E2E | [partial] |
| Tests/question bank/review | Builder + examiner queue | `/admin/tests`, `/examiner/tests/*` | Test models | `tests.manage`/examiner | Unit/e2e partial | [partial] |
| Bookings/classes | Read and admin blocks | `GET /admin/bookings`, `POST /availability/admin/blocks` | Booking/BlockedPeriod | `ADMIN/STAFF` + `bookings.read` | API e2e admin read | [complete] |
| Finance | Payments/refunds/discounts/payouts | `/admin/payments`, `/payments/:id/refunds`, `/payouts/*` | Payment, ledger, payout, discount | finance permissions | Partial | [partial] |
| CMS/settings/translations | CRUD settings and CMS pages | `GET/PUT /admin/settings`, `GET/PUT /admin/cms/:slug` | `PlatformSetting`, `CmsPage` | settings/cms permissions | Not enough | [partial] |
| Roles/permissions/reports | Admin role assignment/revocation, permission grants and reports | `GET /admin/roles`, `/permissions`, `/reports`, `POST /admin/roles`, `/admin/roles/revoke`, `/admin/permissions/grant` | `Permission`, `UserRole`, `RolePermission`, grouped operational models, audit | `roles.manage`, `reports.read` | API e2e admin CRUD/read | [complete] |

## Backend Domains

| Domain | Main persistence | Status |
| --- | --- | --- |
| Auth, JWT refresh rotation, OTP, SMS adapter | `User`, `RefreshSession`, `OtpChallenge`, `NotificationDelivery` | [complete] |
| Teachers and verification | `Teacher`, `VerificationItem`, history, files | [partial] |
| Matching | `MatchingSession`, `MatchingRecommendation` | [complete] |
| Tests/scoring/review | `TestDefinition`, sections/questions/answers/attempts | [partial] |
| Availability/bookings/classes | Availability, blocks, `Booking`, `ClassSession`, credits | [partial] |
| Payments/wallet/refunds/discounts | `Payment`, `WalletEntry`, `Discount` | [complete] for core create/callback/refund/rollback/idempotency; [partial] for full reconciliation UI |
| Packages/enrollments/credits | `Package`, `Enrollment`, `CreditLedgerEntry` | [partial] |
| Earnings/payouts | `Earning`, `PayoutBatch`, `PayoutItem` | [partial] |
| Notifications/SMS/BullMQ | `Notification`, `NotificationDelivery`, Redis queue | [partial] [dev-adapter]; admin delivery logs added |
| Tickets/files/settings/CMS/audit | Relevant Prisma models | [partial] |
| Roles/permissions | `Permission`, `UserRole`, `RolePermission` | [partial] |

## Immediate Implementation Queue

1. Expand browser/e2e coverage for working panel action forms and mutations.
2. Add translation-specific records only if translations are separated from CMS; current implementation stores bilingual CMS content in `CmsPage`.
3. Finish full reconciliation UI and external provider production credential checks.
4. Finish IELTS UX: per-section timers/timeout handling, admin builder UI, examiner scoring UI.
5. Finish file upload UI for teacher verification/video and support attachments.
6. Expand Jest/Supertest/Playwright coverage for the new forms and financial/booking state transitions.
7. Search and remove runtime mock/fake/preview/placeholder/TODO/FIXME/unimplemented code, except documented development adapters.
8. Run Prisma format/validate/generate/migrate/seed, lint/typecheck/tests/e2e/build and Docker health checks.


## 2026-07-19 blocking-fix verification

- Examiner `reviewed` queue now contains only `APPROVED` answers; `NEEDS_REVISION` has its own queue.
- Learners can resubmit only answers marked `NEEDS_REVISION`; previous review metadata is cleared and the answer returns to `PENDING` without reopening approved answers.
- Blocked-period UI initialization was moved out of render, availability/public-slot caches are invalidated after mutations, and slot dates are generated in the teacher timezone rather than by UTC weekday.
- Existing approved prices stay public and bookable while a replacement proposal is reviewed.
- Counter-offer acceptance clears counter fields and creates an audit record.
- Empty payout batches are rejected with the localized `NO_ELIGIBLE_TEACHER_EARNINGS` explanation and eligibility counts.
- Unit/component verification: 13 suites and 27 tests passed. API build passed. The generated Next.js production artifact served `/` with HTTP 200.
- Live migration/seed/API health and Playwright navigation remain environment-blocked because Docker/database services are unavailable and Chromium navigation is administratively blocked in this runtime. See `DELIVERY_REPORT.md`.
