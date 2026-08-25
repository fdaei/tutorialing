# SEC-210 coverage plan — automated ownership-check regressions

Fixes **SEC-210** (`AUDIT/security-phase-2-report.md`). Reviewed before writing this:
`AUDIT/02-security.md §2.2` (the manual review each `SELF_SCOPED` route's scoping was originally
verified against), `apps/api/src/authorization.spec.ts` (the `SELF_SCOPED` allowlist, lines 99-121),
and the existing `*.spec.ts` files for the services behind those routes.

## The gap

`authorization.spec.ts` enforces that every route makes *some* deliberate access decision, but for
the 42 `SELF_SCOPED` routes — authenticated, no `@Roles`/`@Permissions`, correct by construction only
because the service filters by the caller's own id — nothing re-verifies at runtime that the filter
is actually still there. That guarantee rests entirely on the one-time manual citation in
`02-security.md §2.2`. A future refactor could weaken or drop a `where: {userId}` clause and no test
would fail.

## All 42 self-scoped routes (from `authorization.spec.ts`)

| Family | Routes | Backing service/method |
|---|---|---|
| Bookings | `POST /bookings`, `GET /bookings/me`, `POST /bookings/:id/cancel`, `POST /bookings/:id/reschedule`, `POST /bookings/:id/reschedule/accept`, `POST /bookings/:id/reschedule/decline` | `bookings.service.ts` |
| Packages | `GET /packages/enrollments/me` | `packages.service.ts` |
| Payments | `POST /payments`, `POST /payments/:id/gateway`, `GET /payments/wallet`, `GET /payments/wallet/transactions`, `GET /payments/invoices` | `payments.service.ts`, `wallet.service.ts` |
| Files | `POST /files/uploads`, `POST /files/uploads/:id/content`, `POST /files/:id/complete`, `GET /files/:id/download` | `files.service.ts` |
| Learning | `GET /learning/plans`, `POST /learning/assignments/:id/submit` | `learning.service.ts` |
| Matching | `POST /matching`, `GET /matching/history` | `matching.service.ts` |
| Notifications | `GET /notifications`, `PUT /notifications/:id/read` | `support.service.ts` |
| Support | `POST /support/tickets`, `GET /support/tickets`, `GET /support/tickets/:id`, `POST /support/tickets/:id/replies` | `support.service.ts` |
| Reviews | `POST /reviews` | `reviews.service.ts` |
| Teacher application | `POST /teacher/application`, `PATCH /teacher/application`, `POST /teacher/application/submit` | `teachers.service.ts` |
| Tests | `POST /tests/attempts`, `GET /tests/attempts/history`, `GET /tests/attempts/:id`, `PATCH /tests/attempts/:id/answers`, `POST /tests/attempts/:id/sections/:sectionId/submit`, `POST /tests/attempts/:id/submit` | `tests.service.ts` |
| Users | `GET /users/me`, `PUT /users/me`, `PUT /users/me/locale`, `GET/PUT/DELETE /users/me/favorites*` | `users.service.ts` |

## Risk ranking

**Highest risk — money or sensitive-document exposure, or the explicit categories this task
requires — get automated tests in this pass:**

| Route | Why highest risk |
|---|---|
| `POST /payments/:id/gateway` | Money-adjacent: hands back a live gateway redirect/authority for a specific payment by id |
| `GET /files/:id/download` | Can be a verification document or a speaking-test recording — a signed download URL for another user's file is a direct PII/document leak, not just metadata |
| `GET /support/tickets/:id` | Ticket bodies can contain personal information exchanged with support |
| `GET /tests/attempts/:id` | Exam content and (once graded) scores/band results — academic-record confidentiality |

**Medium risk, not covered in this pass (documented for a future increment):** `GET /bookings/me`
and the booking mutation routes (booking rows include another party's name but are already
transitively covered by `payments.service.spec.ts`'s booking-ownership tests from Phase 1);
`GET /payments/wallet*`/`invoices` (see note below — structurally can't take another user's id as
input, so the IDOR shape doesn't apply the same way); `PUT/DELETE /users/me/favorites/:teacherId`
(low-sensitivity — reveals only which teachers a user favorited, and the resource being mutated is
always the caller's own favorites row).

**Lower risk, not covered:** `GET /notifications`, `/learning/plans`, `/matching/history`,
`/teacher/application` — all read-only or write-your-own-record operations over
non-financial, non-document data, already covered by `where: {userId}`-shaped queries with existing
(non-IDOR-specific) test coverage of their happy paths.

## What gets automated tests in this pass

| Area | Service.method | New/extended spec file | Case |
|---|---|---|---|
| Payments | `PaymentsService.gatewayRedirect(userId, paymentId)` | `payments.service.spec.ts` (extend existing `describe('PaymentsService.gatewayRedirect')`) | User B's id passed as `userId` against User A's `paymentId` → rejected, gateway never called |
| Files | `FilesService.download(requesterId, roles, id)` | `files.service.spec.ts` (**new** — no spec file existed for this service before) | User B (non-owner, non-reviewer role) requests User A's file id → `FILE_NOT_FOUND`, no signed URL issued |
| Support | `SupportService.detail(userId, roles, ticketId)` | `support.workflow.spec.ts` (extend) | User B (non-staff) requests User A's ticket id → `TICKET_NOT_FOUND` |
| Tests | `TestsService.resume(userId, id)` | `tests.service.resume.spec.ts` (extend) | User B requests User A's attempt id → no attempt data returned (see note below) |

Each test constructs two distinct users and asserts the **negative** path (User B denied) — not
just that the owner's happy path still works, per the task's requirement not to test only successful
owner access. A positive "owner can still access their own resource" case is included alongside each
negative one, both to keep the tests meaningful (a mock that always returns `null` would trivially
"pass" a negative-only suite) and to pin the routes' actual working behavior.

### Note on `TestsService.resume` — response shape, not a data leak

`resume()` returns `this.db.testAttempt.findFirst({ where: { id, userId }, ... })` directly, with no
`notFound()`/`requireValue()` wrapper (unlike `files.service.ts` and `support.service.ts`, both of
which explicitly throw a domain 404). For a non-owner, this resolves to `null`, and the controller
(`tests.controller.ts` `resume()`) returns that as-is — **HTTP 200 with a `null` body**, not a 403/404.
This is **not a data leak** (no other user's attempt data is ever returned) and is not part of
SEC-210's finding, but it's an inconsistency worth naming: every other self-scoped route tested here
throws an explicit 404. Flagging as a **candidate low-severity follow-up** (working title `SEC-211`,
not filed as a numbered finding in this pass since it's a response-shape/consistency observation, not
an access-control gap) rather than silently changing `resume()`'s behavior, which would be a scope
change beyond "add regression tests" and would need its own review the way SEC-207/SEC-208 did. The
test below asserts the actual current behavior (no attempt data returned to User B), which is the
property that matters for SEC-210.

## Requirements followed

- Realistic fixtures: two distinct user ids per test, resource rows shaped like the real Prisma
  models each service queries (not empty/placeholder objects).
- Negative authorization paths are the point of every new test; each also keeps one positive
  (owner-succeeds) case so the suite can't trivially pass by always denying.
- No production code changed for this task except where explicitly directed (`auth.service.ts` for
  SEC-209, already done and unrelated to this file).
