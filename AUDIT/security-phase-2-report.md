# Phase 2 — Security audit (Prompt-1 methodology run)

Baseline commit: `04485b0` (post AUD-002 fix — the conflict-marker/common-auth-consolidation
commit `124b646` plus its audit-trail entry). Prior-pass documents consulted and re-verified
below: `AUDIT/state.json`, `AUDIT/02-route-matrix.md`, `AUDIT/02-security.md`, `AUDIT/03-isolation.md`,
`AUDIT/02-schema-auth-identity.md`.

**Relationship to `02-security.md`.** That document is a full Phase-2-equivalent security pass from
the *prior* "schema-documentation" audit run (tracked separately in `state.schema-pass.json`), not
from the current Prompt-1 run. Its SEC-201–SEC-206 findings are real and several are already fixed
(commits `8f6ddfe`, `f26e66b`) — this report **re-verifies every one of them against current code**
rather than re-deriving them from scratch, and adds the findings that fall out of the deeper pass
requested for this phase (JWT/session internals, privilege-escalation paths, database access
boundaries). Treat this file as the current-run deliverable; `02-security.md` remains the record of
what the prior pass found and why.

**What changed since `02-security.md` was written, relevant to this review:** the `common/auth.ts` →
`common/core` barrel consolidation (`124b646`, this session), `STR-201`/`STR-202` (API lint +
module-boundary enforcement), `SEC-203`/`SEC-205` fixes, and `SEC-206` (route-authorization-matrix
regression test). All are import-path/structural changes or additive tests — no controller or
service business logic changed underneath them, confirmed by diffing every touched file and by the
full test suite (234 tests) passing unchanged.

---

## 2.0 Architecture recap (post-refactor)

- **Guard chain** (`app.module.ts`, global `APP_GUARD`, in order): `RateLimitGuard` →
  `AccessGuard` → `AuthorizationGuard`. All three now live under
  `apps/api/src/common/core/guards/`, resolved through the single `./common` barrel
  (`common/index.ts` → `core/index.ts` → `core/guards/index.ts`). No controller imports a guard or
  decorator directly; everything but two decorator files (`Authorize`, `PublicRateLimit`) and two
  util files (`assertDomain`/`requireValue`, `runtimeEnvironment`) lives under `common/core`, and
  those four are explicitly re-exported into the `core` barrel — verified no dangling references to
  the deleted `common/auth.ts` or `common/errors` paths remain anywhere in `apps/api/src`.
- **`AccessGuard`** (`common/core/guards/access-token.guard.ts`): verifies the JWT with a pinned
  `['HS256']` algorithm allowlist, then calls `TokenRevocationService.revokedAt()` and rejects if
  the token's `iat` is at or before the last revocation timestamp for that user — **fails closed**
  (503) for `ADMIN/FINANCE/STAFF/SUPPORT/EXAMINER` roles on a Redis error, **fails open** for
  everyone else (documented trade-off, re-verified intact).
- **`AuthorizationGuard`**: role check is `.some()` (any listed role), permission check is
  `.every()` (all listed permissions) — standard, correct RBAC composition.
- **8 controllers** (`auth`, `payments`, `payouts`, `languages`, `support`, `teachers/pricing`,
  `teachers/reviews`, `teachers/verification`, `tests`) now use the composed `@Authorize(roles,
  permissions)` / `@PublicRateLimit(options)` decorators instead of separate `@Roles`/`@Permissions`
  or `@Public`/`@RateLimit`. `authorization.spec.ts` was updated in the same change to recognise the
  composed forms as equivalent, and its own test suite (route-bucket classification, public-surface
  cap, rate-limit-on-public-writes, SEC-205 pin) passes against current code — **the route × role
  matrix in `02-route-matrix.md` remains accurate in substance**; only the decorator syntax changed
  for those 8 files. Spot-checked `payments.controller.ts`, `payouts.controller.ts`,
  `teachers/pricing.controller.ts` line-by-line against the recorded matrix — no drift.

---

## 2.1 Route × role matrix — re-verification

`authorization.spec.ts` (added under SEC-206) is a standing structural guardrail, not a one-time
report: it parses every `*.controller.ts` under `src/modules` and forces each route into exactly one
of `@Public`, role/permission-gated, or an explicit 42-route `SELF_SCOPED` allowlist — a route
matching none of these fails the build. Re-run as part of `npm run test -w @lingospeak/api`: **210
tests pass**, including this one, on current `HEAD`. This means:

- **"Missing guard" risk is structurally mitigated** for *new* routes — a route added without a
  guard decorator and without being added to `SELF_SCOPED` cannot ship (test fails).
- It does **not** re-verify, at runtime, that the service-layer scoping for the 42 `SELF_SCOPED`
  routes is still correct — that guarantee rests on the one-time manual review recorded in
  `02-security.md §2.2` (each route's scoping mechanism and file:line) plus ordinary code review of
  future changes to those services. See **SEC-210** below.
- Public surface: capped at ≤16 routes by the test; currently 14, unchanged from `02-route-matrix.md`.

---

## 2.2 Authentication — JWT lifecycle, refresh, revocation, session handling

| Control | Implementation | Verdict |
|---|---|---|
| Access token | HS256, 15 min TTL, claims `{id, roles, permissions, sessionId}` baked in at issuance (`auth.service.ts:130`) | PASS |
| Algorithm pinning | `access-token.guard.ts:42` — `verifyAsync(token, {algorithms:['HS256']})` | PASS (SEC-203, re-verified) |
| Refresh token | `sessionId.secret` format, 32 random bytes (base64url), plain SHA-256 stored (`auth.service.ts:10,124`) | PASS — see SEC-209 for a narrower note |
| Refresh rotation | Every `refresh()` call revokes the presented session and creates a new one in the same `familyId` (`auth.service.ts:157-161`) | PASS |
| Refresh reuse detection | An invalid/expired/revoked/hash-mismatched refresh token revokes the **entire family** (`auth.service.ts:153-155`), not just the one session | PASS — correctly treats reuse as a signal the whole chain is compromised |
| Revocation | `TokenRevocationService` — Redis key `revoked:user:{id}`, 1h TTL, compared against the token's `iat` (`token-revocation.service.ts`) | PASS |
| Revocation triggers | `updateUserStatus` (suspend/delete), `setUserRoles`, `assignRole`, `revokeRole`, `grantPermission` all call `revocation.revokeUser()` | PASS — every privilege-affecting path is covered |
| OTP entropy/storage | CSPRNG `randomInt(100000,1000000)`, HMAC-SHA256 under a pepper derived from `JWT_ACCESS_SECRET` (`auth.service.ts:26-31`) | PASS |
| OTP verification | `timingSafeEqual` used for the code comparison (`auth.service.ts:98-99`) | PASS |
| OTP/account enumeration | `requestOtp` always `upsert`s the user; identical response shape for known/unknown numbers | PASS |
| Dev-OTP guard | `env.validation.ts:119-123` — startup throws if `AUTH_DEV_OTP=true` and `NODE_ENV=production` | PASS |
| SMS fail-closed | `sms.service.ts:24-29` — no Kavenegar key and no dev flag → `ServiceUnavailableException`, never silently "sent" | PASS |
| Cookie handling | `refresh_token`: `httpOnly`, `secure` in production, `sameSite:'lax'`, `path:/api/auth` (`auth.controller.ts:29-37`) | PASS — `sameSite:lax` blocks cross-site POST/fetch delivery of the cookie, which is what matters since refresh/logout are POST-only |
| `trust proxy` | `main.ts:25` — `app.set('trust proxy', cfg.TRUST_PROXY)`, explicitly set *before* any per-IP rate-limit read, default `0` (`config/defaults.ts:9`) | PASS as shipped — see note below |

**Note on `TRUST_PROXY` default `0`.** With `trust proxy=0`, Express uses the socket's remote
address, ignoring `X-Forwarded-For` entirely. That's the *safe* default (no header-spoofed IP can
forge another client's rate-limit bucket), but if this API is deployed behind any reverse
proxy/load balancer without setting `TRUST_PROXY` to the correct hop count in that environment's
`.env`, every request will appear to originate from the proxy's single IP, and all IP-keyed rate
limits (`RateLimitGuard`, OTP send/verify, refresh, logout, booking mutations) collapse onto one
shared bucket for **all users behind that proxy** — a self-inflicted denial of service, not an
attacker-exploitable bypass. This is an operational/deployment-config risk, not a code defect;
flagged so it's checked at deploy time (`README.md`/`SECURITY.md` env reference).

### SEC-209 — Refresh-token hash comparison is not constant-time — **LOW — OPEN (new)**

- **Severity:** Low
- **Location:** `apps/api/src/modules/auth/auth.service.ts:153` — `hash(secret) !== session.tokenHash`
- **Risk explanation:** The refresh-token secret is hashed (`sha256`) and compared with plain
  string `!==`, unlike the OTP code comparison three lines away in the same file, which
  deliberately uses `timingSafeEqual` (`auth.service.ts:98-99`, with a comment explaining why). A
  non-constant-time comparison of secret material is a standard hardening finding.
- **Exploit scenario:** In principle, an attacker who can make a very large number of
  precisely-timed requests against `/auth/refresh` could try to infer information about
  `session.tokenHash` from per-character comparison timing. In practice this is not meaningfully
  exploitable here: (a) the value being compared is a SHA-256 **digest**, and SHA-256's avalanche
  property means a guessed refresh secret that's "closer" in hash-prefix-match terms is not closer
  in secret-value terms — there is no smooth gradient for a timing attack to climb; (b) the
  underlying secret space is 256 bits, well beyond brute force even with a working timing oracle;
  (c) network jitter over HTTP makes byte-level timing extraction very hard in the first place. This
  is a defense-in-depth / consistency gap, not a demonstrated practical exploit.
- **Recommended fix:** Use `timingSafeEqual` on the two hash buffers (matching the OTP path), with a
  length check first since `timingSafeEqual` throws on mismatched buffer lengths.
- **Implementation complexity:** Trivial — one-line change, already have the pattern in the same file.

---

## 2.3 Authorization — permission boundaries, missing guards, privilege escalation

### SEC-207 — `roles.manage` lets a non-ADMIN grant FINANCE-level and other high-impact capability it does not itself hold — **HIGH — OPEN (new)**

- **Severity:** High
- **Location:** `apps/api/src/modules/admin/admin.service.ts` — `setUserRoles` (:177-215),
  `assignRole` (:241-257), `grantPermission` (:282-304). Reached via `PATCH /admin/users/:id/roles`,
  `POST /admin/roles`, `POST /admin/permissions/grant` (`admin.controller.ts:40-122`), all gated
  only by `@Permissions('roles.manage')`.
- **Risk explanation:** `assignRole`/`setUserRoles`/`grantPermission` each special-case exactly one
  role label — `role === 'ADMIN'` triggers `assertActorIsAdminToGrantAdmin()`, which requires the
  actor already hold the `ADMIN` role. No equivalent check exists for any other role
  (`FINANCE`, `STAFF`, `SUPPORT`, `EXAMINER`, `TEACHER`) or for the permission being granted in
  `grantPermission` — that method accepts **any existing `Permission.key`** (validated only for
  existence, not for the actor already holding it: `admin.service.ts:285-286`). The codebase's own
  comment on `assertActorIsAdminToGrantAdmin` (`admin.service.ts:29-37`) explains the intended
  model — "`roles.manage`/`permissions.manage` are delegable to STAFF without full ADMIN" — but the
  implementation only closes the gap for the literal `ADMIN` label, leaving every other
  high-impact role and permission (`payments.refund`, `payouts.manage`, `settings.manage`, and
  `roles.manage` itself) grantable by anyone holding `roles.manage`, regardless of whether *they*
  hold it. This is not hypothetical under current seed data: `prisma/seed.ts:169` grants **every**
  permission in `permissionKeys` (including `roles.manage`, `payments.refund`, `payouts.manage`) to
  the `STAFF`, `SUPPORT`, `FINANCE`, and `EXAMINER` seed accounts alike — so in the shipped default
  configuration, the `STAFF` account already has exactly the capability described below.
- **Exploit scenario:** A `STAFF` account holding only `roles.manage` (no `ADMIN` role) does, using
  a second account it controls (or a compromised low-privilege account it can reach via support
  tooling):
  1. `POST /admin/roles` `{userId: <accomplice>, role: "FINANCE"}` — succeeds; `role !== 'ADMIN'`
     so no admin-holding check fires.
  2. `POST /admin/permissions/grant` `{userId: <accomplice>, role: "FINANCE", permission:
     "payments.refund"}` — succeeds for the same reason; the actor is never checked for already
     holding `payments.refund` or `FINANCE`.
  3. The accomplice account re-authenticates (or the actor calls `revocation` is already forced by
     step 1/2, so the accomplice simply logs in again); its new access token now carries
     `roles: ["FINANCE", ...]` and `permissions: [..., "payments.refund"]`, satisfying
     `AuthorizationGuard` for `POST /payments/:id/refunds` (`roles: ADMIN,FINANCE` +
     `payments.refund`) — a money-moving endpoint — without the original `STAFF` actor, or the
     accomplice, ever having been `ADMIN` or `FINANCE` by legitimate assignment. The same pattern
     grants `payouts.manage` (approve/generate payouts, transfer withdrawals) or re-propagates
     `roles.manage` itself onto further accounts, laterally multiplying the number of accounts that
     can repeat this chain.
- **Recommended fix:** Require the actor to already hold whatever they're attempting to hand out,
  for both roles and permissions — the general "can't delegate a key you don't hold" rule — as a
  default, with `ADMIN`-only carve-outs kept for the specific set of roles/permissions considered
  irrevocably sensitive (at minimum `FINANCE` role, `payments.refund`, `payouts.manage`,
  `settings.manage`, `roles.manage` itself). Concretely: add an `assertActorHoldsRole`/
  `assertActorHoldsPermission` check alongside `assertActorIsAdminToGrantAdmin`, called from all
  three mutation paths, and add a regression test asserting a `STAFF`-only actor cannot grant
  `FINANCE`/`payments.refund`/`payouts.manage`/`roles.manage` to anyone.
- **Implementation complexity:** Medium. No schema change needed (the data to check — the actor's
  own `UserRole`/`RolePermission` rows — already exists and is queried elsewhere in the same file).
  The work is deciding the exact policy (hold-to-grant vs. a hardcoded high-impact allowlist —
  recommend both: hold-to-grant as the default rule, plus the explicit allowlist for the money-moving
  set as defense in depth) and updating `assignRole`, `setUserRoles`, `grantPermission`, and
  `createUser` (which has the same `roles.includes('ADMIN')`-only pattern at `admin.service.ts:136`)
  consistently, with tests for each.

### SEC-208 — Generic staff search endpoint exposes payment and role data to roles that don't need it — **MEDIUM — OPEN (new)**

- **Severity:** Medium
- **Location:** `apps/api/src/modules/search/search.controller.ts:9` —
  `@Roles('ADMIN','STAFF','FINANCE','SUPPORT','EXAMINER')` with **no `@Permissions()`** gate;
  `search.service.ts` — every entity handler (`users`, `payments`, `roles`, `bookings`, etc.) is
  reachable by any of those five roles alike.
- **Risk explanation:** The five roles gated in have materially different job functions — `EXAMINER`
  scores IELTS tests, `SUPPORT` handles tickets — yet both can call `GET /search/payments` (returns
  `amount`, `status`, `purpose`, `createdAt`, and the paying user's `name`/`phone` —
  `search.service.ts` payments handler) and `GET /search/roles` (role/permission assignments), data
  with no relationship to either role's function. The controller comment (`search.controller.ts:6-8`)
  records that a prior fix (RATE-005) closed the "any authenticated user" gap by adding the role
  list, but no per-entity permission check was added — the endpoint conflates "is staff" with "may
  see everything staff can see."
  - **Distinguish from IDOR:** this is not an object-level authorization failure — a `SUPPORT` agent
  is legitimately authenticated staff. It is a least-privilege / need-to-know gap: broader data
  exposure than the role's function requires, which matters for this endpoint specifically because
  `payments` results include amounts and payer PII.
- **Exploit scenario:** A compromised or malicious `EXAMINER` or `SUPPORT` account (roles with a
  narrower, lower-trust function than `FINANCE`/`ADMIN`/`STAFF`) queries
  `GET /search/payments?q=<phone-or-name>` to look up any user's payment history, or
  `GET /search/roles?q=` to enumerate who holds which roles/permissions — reconnaissance useful for
  the SEC-207 escalation path above, or simple customer-financial-data snooping outside the
  account's job scope.
- **Recommended fix:** Gate each entity behind its existing corresponding permission —
  `payments` → `payments.read`, `roles` → `roles.manage`, `users` → `users.read`, etc. (these
  permission keys already exist and already gate the equivalent `/admin/*` read endpoints per
  `02-route-matrix.md`) — checked per-entity inside `SearchService.search()`, or by splitting the
  role list per entity at the controller if NestJS route-level granularity is preferred.
- **Implementation complexity:** Low–Medium. The permission keys and their semantics already exist;
  the change is adding a lookup (`@CurrentUser()` permissions, already available via `AuthUser`) and
  a per-entity check in the `switch` in `search.service.ts`, plus updating
  `authorization.spec.ts`/route-matrix docs and adding tests for the negative case (EXAMINER
  querying `payments` → 403).

### SEC-210 — Self-scoped route ownership checks are not covered by automated regression tests — **LOW — OPEN (new, process)**

- **Severity:** Low
- **Location:** `apps/api/src/authorization.spec.ts:94-121` (the `SELF_SCOPED` allowlist) and the 42
  services it references (`payments.service.ts`, `files.service.ts`, `support.service.ts`, etc.)
- **Risk explanation:** `authorization.spec.ts` guarantees every route makes *some* deliberate access
  decision, but for the 42 `SELF_SCOPED` routes the guarantee that the service actually filters by
  the caller's own id rests entirely on the one-time manual review cited in the allowlist's own
  comment ("each confirmed in `AUDIT/02-security.md §2.2`"). There is no automated test that, e.g.,
  asserts `GET /bookings/me` cannot return another user's booking, or that `/files/:id/download`
  404s for a non-owner. A future change to one of those 42 services could silently drop or weaken an
  ownership `where` clause without any test failing — unlike the route-guard-presence property,
  which *is* enforced by the same file.
- **Exploit scenario:** Not itself exploitable — this is a test-coverage gap, not a live
  vulnerability. The risk is regression: a refactor of, say, `files.service.ts`'s `download()`
  ownership check (`ownerId: requesterId`) ships broken and reaches production undetected because no
  test exercises the negative case (requesting another user's file).
- **Recommended fix:** Add a small IDOR regression suite — for a representative subset of the 42
  routes (at minimum the money- and PII-bearing ones: `payments/wallet`, `files/:id/download`,
  `support/tickets/:id`, `tests/attempts/:id`), assert a second user's token gets 404/403, not the
  first user's data.
- **Implementation complexity:** Low–Medium per route; most of these services already have
  `*.spec.ts` files with fixtures the new cases can extend.

---

## 2.4 API security / OWASP Top 10 (2021) — re-verified

| # | Category | Status | Change since `02-security.md` |
|---|---|---|---|
| A01 | Broken access control | **PASS**, with new findings | Route×role matrix re-verified structurally sound (§2.1); **SEC-207/SEC-208 are new A01 findings** — privilege-boundary and least-privilege gaps, not IDOR |
| A02 | Cryptographic failures | **PASS** | Unchanged. **SEC-209** (new, low) notes a consistency gap, not a break |
| A03 | Injection | **PASS** | Re-checked: still only `$queryRaw` is `health.ts`'s literal `SELECT 1`; every dynamic query reviewed in this pass (`search.service.ts`, `admin.service.ts`) uses Prisma's parameterised `contains`/`where` builders, no string concatenation into queries |
| A04 | Insecure design | **PASS** | Unchanged (Phase 1 findings) |
| A05 | Security misconfiguration | **PASS** | Re-verified `main.ts`: `helmet()`, single-origin CORS with `credentials:true`, `trust proxy` explicitly set before rate limiting, Swagger prod-gated, `ValidationPipe` whitelist/forbidNonWhitelisted still global |
| A06 | Vulnerable components | **FAIL, but improved** | **SEC-201 updated** — re-run `npm audit --omit=dev`: 5 high, but 4 of those (the `prisma`→`@prisma/config`→`deepmerge-ts` chain) are **devDependency-only** (`prisma` CLI is a devDependency in `apps/api/package.json`; `npm ls @prisma/config` shows the only path to it is through that devDependency) — the `--omit=dev` flag misattributes it due to workspace hoisting. Genuinely production-reachable: **1** (`@nestjs/swagger`→`js-yaml`, same as before, mitigated by Swagger being prod-disabled). The `next`/`sharp`/`nanoid` advisories present in the prior pass no longer appear at all — resolved by dependency updates since |
| A07 | Auth failures | **PASS** | §2.2 above; no new findings beyond SEC-209 |
| A08 | Integrity failures | **PASS** | Unchanged. SEC-202 (upload MIME not content-sniffed) re-verified still open, unchanged code (`files.service.ts:44`) |
| A09 | Logging failures | **PASS** | Re-checked: grepped all `logger.log/debug/verbose` and `console.log/debug` calls across `apps/api/src` for OTP/token/secret/phone/password content — none found. `ApiExceptionFilter` never returns a stack trace or raw driver error in the response body (`api-exception.filter.ts:47`, only `'Internal server error'` for 5xx) |
| A10 | SSRF | **PASS** | Unchanged |

---

## 2.5 Database — query authorization, data access boundaries

This application has no multi-tenant/organization model, so "tenant isolation" here means
**per-user data isolation** and **staff-role data segmentation**, both reviewed:

- **Per-user isolation (IDOR surface):** re-verified the `02-security.md §2.2` table's scoping
  claims still hold — `payments.service.ts:61` (`booking.studentId !== userId` → 404),
  `wallet.service.ts:16,26` (`where: {userId}`), `files.service.ts` (`ownerId` matched on
  download/complete), `support.service.ts:31` (`staff ? {} : {userId}`) — none of these files were
  touched by the refactor between this pass and the prior one, and the regression tests covering
  them (`payments.service.spec.ts`, `refunds.service.spec.ts`, `support.workflow.spec.ts`, etc.) all
  pass unchanged. See **SEC-210** for the gap in *automated* coverage of this claim going forward.
- **Staff-role data segmentation:** this is where the new finding is — **SEC-208** — the generic
  search endpoint gates by "is staff-tier" rather than by data-category permission, so `EXAMINER`/
  `SUPPORT` can read `payments`/`roles` data outside their function.
- **Privilege data (`UserRole`/`RolePermission`) integrity:** **SEC-207** is fundamentally a
  database-write authorization problem — the mutation paths that write `UserRole`/`RolePermission`
  rows don't check the actor's own rows before writing new grants for someone else.
- **Schema-level notes** (already recorded in `02-schema-auth-identity.md`, cited not re-derived):
  `OtpChallenge`/`RefreshSession` have no deletion path or TTL index (**F-201**, medium, operational);
  `User.email` is not unique (**F-202**, low); `OtpChallenge.userId` defaults to `SetNull` on delete
  while `RefreshSession` cascades (**F-203**, low); `RefreshSession.replacedById` is an unconstrained
  string, not a FK (**F-204**, low). None of these are exploitable access-control gaps; they're
  data-quality/operational items already tracked and out of scope to re-litigate here.
- **No raw SQL / query-builder injection surface** beyond the single literal `$queryRaw` health
  check, re-confirmed in this pass (§2.4 A03).

---

## 2.6 Findings summary

| ID | Severity | Status | Title |
|---|---|---|---|
| SEC-207 | **HIGH** | OPEN (new) | `roles.manage` grants FINANCE-level capability without the actor holding it |
| SEC-201 | HIGH | OPEN (re-verified, scope corrected) | Dependency advisories — 1 genuinely production-reachable (`js-yaml` via Swagger, prod-disabled), not 5 |
| SEC-208 | MEDIUM | OPEN (new) | Search endpoint exposes payment/role data to roles that don't need it |
| SEC-202 | MEDIUM | OPEN (re-verified, unchanged) | Upload MIME type is client-declared, never content-sniffed |
| SEC-209 | LOW | OPEN (new) | Refresh-token hash comparison not constant-time |
| SEC-210 | LOW | OPEN (new, process) | Self-scoped route ownership checks lack automated regression tests |
| SEC-204 | LOW | ACCEPTED (unchanged) | `dangerouslySetInnerHTML` for the Enamad seal |
| SEC-203 | — | FIXED (re-verified) | JWT algorithm allowlist |
| SEC-205 | — | FIXED (re-verified) | `/bookings` rate limiting |
| SEC-206 | — | FIXED (re-verified) | `/auth/logout` rate limiting |

**No critical findings. No injection, no classic IDOR, no mass-assignment, no committed secrets**
(re-checked). The material change from the prior pass is **SEC-207**: a genuine, evidence-backed
privilege-escalation path from a delegated `STAFF`-tier permission to FINANCE-equivalent capability,
found by tracing the authorization checks the prior pass's mass-assignment review didn't extend to.

### 2.6.1 Remediation order (proposed)

1. **SEC-207** — highest severity, direct financial blast radius, no schema change needed.
2. **SEC-208** — low-medium effort, closes a real least-privilege gap.
3. **SEC-201** — `npm audit fix` for the devDependency chain is free; the one production-reachable
   item (`js-yaml` via Swagger) needs a Next.js-unrelated, smaller-scoped dependency decision than
   SEC-201 previously implied — worth reassessing now that it's isolated to one package.
4. **SEC-209** — trivial one-line change, bundle with any other auth-file touch.
5. **SEC-210** — incremental, can be added test-by-test without a dedicated project.
6. **SEC-202** — unchanged from prior assessment; still needs a content-sniffing dependency/table,
   scoped work.
7. **SEC-204** — accepted, no action.

---

## 2.7 Do not modify code yet

Per instruction, this phase is report-only. No application code was changed while producing this
document (only this file and the corresponding `AUDIT/state.json` entries were written). Awaiting
approval before implementing fixes for SEC-207 through SEC-210 (or a subset, per priority above).
