# Phase 2 — Security hardening: final review before commit

Reviews the full, cumulative Phase 2 diff (`git diff --stat`: 11 files changed, 450 insertions, 45
deletions, plus 10 new files) as one unit before it becomes a single commit. Builds on, and does not
re-derive, the per-finding verification already done and recorded when each fix landed
(`AUDIT/security-phase-2-report.md`, `AUDIT/SEC-208-design.md`, `AUDIT/SEC-210-coverage-plan.md`,
`AUDIT/state.json`).

## Completed findings

| ID | Severity | What changed | Verification |
|---|---|---|---|
| SEC-207 | High | New `role-management.policy.ts` (3-tier hierarchy: ADMIN, privileged `{FINANCE, roles.manage, payments.refund, payouts.manage, settings.manage}`, standard everything-else). Wired into `admin.service.ts`'s `createUser`/`setUserRoles`/`assignRole`/`grantPermission`, replacing the ADMIN-only special case | `admin.service.spec.ts` (25 tests incl. 5 new SEC-207-named cases), `role-management.policy.spec.ts` (15 tests), live e2e (`POST /admin/roles`, `POST /admin/permissions/grant` via a real ADMIN token, 201s) |
| SEC-208 | Medium | New `search-access.policy.ts` (entity→permission map, fail-closed on unknown entity). Wired into `search.controller.ts` via `@CurrentUser()` | `search-access.policy.spec.ts` (18 tests, every entity), `search.controller.spec.ts` (9 tests, the 5 required scenarios + extras) |
| SEC-209 | Low | New `constantTimeEqual()` in `auth.service.ts`, used by both `verifyOtp()` and `refresh()` | `auth.service.spec.ts` `describe('AuthService.refresh (SEC-209)')` (7 new tests) plus the 3 pre-existing OTP tests, unaffected |
| SEC-210 | Low | No production code — 6 new/extended regression tests across `payments.service.spec.ts`, `files.service.spec.ts` (new file), `support.workflow.spec.ts`, `tests.service.resume.spec.ts` | Each new test pairs a negative (different-user-denied) and positive (owner-succeeds) case |

## Verification requested

**SEC-207 behavior unchanged where it should be.** Diffed `admin.service.ts` line by line: the only
changes are (a) the constructor gaining `policy: RoleManagementPolicy`, (b) each of the four mutation
methods' guard check being replaced by a call into the policy, and (c) deletion of the
now-superseded `assertActorIsAdminToGrantAdmin`/`adminGrantRequiresAdmin`. Nothing about *what happens
after* a grant is authorized changed — `revocation.revokeUser()` calls, `auditLog.create()` calls,
the `grantAdminPermissions()` auto-grant, the `LAST_ADMIN_ROLE_REMOVE`/`SELF_ADMIN_ROLE_REMOVE`/
`selfElevation` checks, and the `$transaction` in `setUserRoles` are all byte-identical to before.
Confirmed by rerunning the full `admin.service.spec.ts` suite unmodified in logic (only the harness's
constructor call and the new describe block were added) — all pre-existing tests still pass with
their original assertions.

**SEC-208 behavior unchanged where it should be.** `search.service.ts` (the file with all nine
entities' query logic) has a **zero-line diff** — not touched at all. `search.controller.ts`'s
`@Roles(...)`/`@RateLimit(...)` class decorators are unchanged; the only addition is the
`assertMaySearch()` call, which runs *before* `this.s.search(...)` and either lets the exact same
call through or throws before it — no change to what a successful search returns.

**SEC-209 does not affect token lifecycle.** Confirmed directly from the diff: `refresh()`'s only
changed line is the boolean condition inside the existing `if`; token format (`sessionId.secret`),
`expiresAt` computation, `revokedAt`/`replacedById` writes, `createSession()`'s TTL/claims, and
`revokeFamily()`'s `updateMany` call are all outside the diff entirely. The new
`describe('AuthService.refresh (SEC-209)')` tests exercise rotation (test 1: `refreshSession.create`
called, old session marked `revokedAt`+`replacedById`) and reuse detection (tests 2 and 4:
`revokeFamily`'s exact `updateMany` call shape asserted) end to end, and both pass.

**SEC-210 tests are meaningful, not tautological.** Checked each new/extended harness specifically
for the failure mode of "a mock that returns success/failure regardless of input, so the test passes
whether or not the real ownership check exists": every one of the four harnesses (`payments`,
`files`, `support`, `tests`) implements its Prisma-mock `findFirst`/`findFirstOrThrow` as a function
of its `where` argument, not a blanket `mockResolvedValue`. The `payments.service.spec.ts` case
required *fixing* the pre-existing `gatewayRedirectHarness`, which previously ignored its `where`
args entirely (see `AUDIT/state.json` SEC-210 entry) — without that fix, an IDOR test against it
would have falsely passed. Each of the four also has a paired positive case (owner still succeeds),
so the suite can't trivially pass by denying everyone.

## Checks

- **No accidental permission bypass:** re-read `assertMayGrantRole`/`assertMayGrantPermission` for
  short-circuit bugs — both `if` blocks require an explicit `!(await this.actorHoldsAdmin(actorId))`
  before throwing (i.e., default-deny is not accidentally inverted), and `assertMaySearch` requires
  `permissions.includes(required)` (not `some`/`any`-style looseness). `search-access.policy.spec.ts`
  includes the "does not let holding one entity permission unlock a different entity" case
  specifically to catch a map/lookup mistake.
- **No broken admin flows:** the live e2e run (`platform.e2e-spec.ts`, real Postgres/Redis/MinIO, real
  DI container — not mocks) exercises `GET /admin/bookings`, `GET /admin/roles`, `GET /admin/reports`,
  `POST /admin/roles`, and `POST /admin/permissions/grant` against a genuine ADMIN-seeded token; all
  five return their expected 200/201 both before and after every Phase 2 change landed.
- **No regression in authentication:** `auth.service.spec.ts`'s pre-existing OTP tests (hashing,
  verification, wrong-code rejection) pass unmodified after `constantTimeEqual` replaced their inline
  comparison; the e2e `authenticates with persisted OTP and protects the profile` case still passes.
- **No unrelated files modified:** `git status --porcelain` for the full session's changes lists only
  `apps/api/src/modules/{admin,auth,search,commerce/payments,support,tests,files}/*`,
  `apps/web/src/lib/api-error-messages.ts`, `AUDIT/*`, and `ROLE_MANAGEMENT_POLICY.md` — every file is
  directly attributable to one of SEC-207/208/209/210. `prisma/seed.ts`, dependency manifests
  (`package.json`/`package-lock.json`), `files.service.ts`'s upload/MIME logic, and
  `apps/api/test/platform.e2e-spec.ts` were read for context but never edited.

## Security improvements (summary)

- Closed a High-severity privilege-escalation path from a delegated `roles.manage` permission to
  full FINANCE-equivalent capability (SEC-207) — the most consequential fix this phase, with a
  concrete, seed-data-confirmed exploit chain.
- Closed a Medium-severity least-privilege gap letting any staff-tier role read payment and role data
  outside its function via the generic search endpoint (SEC-208).
- Hardened refresh-token verification to constant-time, matching the already-correct OTP path
  (SEC-209) — defense-in-depth, no known live exploit.
- Added regression coverage for the ownership checks behind the four highest-risk self-scoped route
  families, closing the gap where a future refactor could silently drop a `where: {userId}` clause
  undetected (SEC-210).

## Test coverage added

56 new tests across 4 finding areas: SEC-207 (25, split between `admin.service.spec.ts` and the new
`role-management.policy.spec.ts`), SEC-208 (27, split between the new `search-access.policy.spec.ts`
and `search.controller.spec.ts`), SEC-209 (7, in `auth.service.spec.ts`), SEC-210 (6, across four
files, one new). Full API suite: **279 tests, 42 suites, all passing** (up from 234 at the start of
Phase 2).

## Remaining known risks

Carried forward, not addressed in Phase 2 (see Step 2 tracking below for formal IDs):

- **SEC-201** (dependency currency) and **SEC-202** (upload content-sniffing) — open per
  `security-phase-2-report.md`, out of this phase's scope by the user's explicit instruction.
- **SEC-211** (new, documented not fixed) — `TestsService.resume()` returns `200 null` rather than a
  404 for a non-owner; not a data leak, a response-shape inconsistency.
- **RBAC-001** (new, documented not fixed) — `prisma/seed.ts` grants every permission key to every
  staff-tier seed account, so SEC-207/SEC-208's mechanism fixes don't visibly change behavior against
  today's seeded/demo data until seed data is separately tightened.
- **TEST-001** (new, documented not fixed) — `platform.e2e-spec.ts`'s admin test shares a student
  token across sequential `it()` blocks in the same file; an unrelated `assignRole` call revokes it
  mid-file, causing a later assertion to see 401 instead of 201. Pre-existing, independently
  reproduced against pre-Phase-2 code via `git stash`, unrelated to any Phase 2 change.
