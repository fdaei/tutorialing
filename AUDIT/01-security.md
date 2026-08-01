# LingoSpeak Security Audit — Phase 1

Scope: `apps/api` (NestJS 11 + Prisma + PostgreSQL + Redis + BullMQ), with supporting checks
against `apps/web/src/middleware.ts` (CSP) and `apps/web/src/lib/panel-access.ts` (client-side
route gating). Read-only review; every claim is backed by a `path:line` citation from the code
as it exists in the working tree at review time. Where a claim could not be directly verified in
code it is marked `UNVERIFIED`.

No live credentials/secrets were found during this review (env files were not scanned for
values; `.env`/`.env.example` were not opened to avoid ever needing to redact a real secret —
`apps/api/src/config/env.validation.ts` was read only for its schema, not for any live value).

---

## CRITICAL

### SEC-001 — Any STAFF user with the delegable `roles.manage` permission can mint a brand-new full ADMIN account, bypassing every self-elevation guard

**Evidence**

- `apps/api/src/modules/admin/admin.controller.ts:31-33` — `POST /admin/users` requires only
  `@Permissions('roles.manage')` (plus the class-level `@Roles('ADMIN','STAFF')` at line 15 —
  i.e. **STAFF is sufficient**, not just ADMIN).
- `apps/api/src/modules/admin/dto/request/create-user.dto.ts:9` — `@IsOptional() roles?: Role[]`
  has **no `@IsEnum`/whitelist validator** on the array contents (contrast with
  `apps/api/src/modules/admin/dto/request/user-roles.dto.ts:5-8`, which does validate with
  `@IsEnum(Role, { each: true })`). Nothing stops the caller from sending
  `"roles": ["ADMIN"]`.
- `apps/api/src/modules/admin/admin.service.ts:66-71` (`createUser`):
  ```
  async createUser(actorId:string,d:{...roles?:Role[]}){
    const roles:Role[]=d.roles?.length?d.roles:['STUDENT'];
    const user=await this.db.user.create({data:{...,roles:{create:roles.map(role=>({role}))}},include:{roles:true}});
    if(roles.includes('ADMIN'))await this.grantAdminPermissions(user.id);
    ...
  }
  ```
  `grantAdminPermissions` (`admin.service.ts:132-135`) grants **every permission row in the
  system** to the new account.
- The `selfElevation()` guard (`admin.service.ts:15-20`) is applied in `setUserRoles`
  (`admin.service.ts:86-87`), `assignRole` (`admin.service.ts:123`), and `grantPermission`
  (`admin.service.ts:149`) — all three compare `userId === actorId`. **`createUser` never calls
  it**, and because the target is a freshly created user, `userId === actorId` can never be true
  regardless.

**Impact**

Authentication is phone + OTP only (`apps/api/src/modules/auth/auth.service.ts:7-9`, no
password/approval step, no email verification loop). Any account that holds the `roles.manage`
permission — which by design (see the comment at `admin.service.ts:8-13`) is meant to be
delegable to STAFF *without* full ADMIN — can create a brand-new user record with the `ADMIN`
role attached to a phone number the attacker controls, then simply request an OTP for that phone
and log in as a fully privileged administrator. This is a complete privilege escalation from
"delegated user-management permission" to "full platform admin," and it is a single unauthenticated
(from the target's perspective) API call.

**Exploit sketch**

1. Attacker holds a STAFF account with permission `roles.manage` (e.g. granted for routine
   support/user-admin work).
2. `POST /api/admin/users` with body
   `{"phone":"0912xxxxxxx","name":"x","roles":["ADMIN"]}` where the phone number is one the
   attacker controls.
3. `admin.service.ts:69` grants every permission to the new user.
4. Attacker calls `POST /api/auth/otp/request` then `POST /api/auth/otp/verify` for that phone
   number and receives an access/refresh token pair with `roles:['ADMIN']` and the full
   permission set (`auth.service.ts:9`).

**Minimal fix suggestion**

- Add `@IsEnum(Role, { each: true })` to `CreateUserDto.roles` (`create-user.dto.ts:9`) at minimum
  so the field can't silently accept anything Prisma will store — this alone does not close the
  hole since `ADMIN` is itself a legitimate enum value.
- Structurally: require the actor to already hold the `ADMIN` role (not just the `roles.manage`
  permission) before `roles` may include `'ADMIN'` in `createUser`, mirroring the intent already
  expressed by `selfElevation()`'s comment that role/permission changes must be a "second person"
  action. Route creation of admin/staff accounts through the same guarded path as
  `assignRole`/`grantPermission` (i.e. create the user with `STUDENT` only, then require a
  separate, audited `assignRole('ADMIN')` call subject to whatever additional check is chosen).

---

### SEC-002 — Correct answers (`Question.answerKey`) are returned to the student while a test attempt is in progress

**Evidence**

- `apps/api/prisma/schema.prisma:861` — `Question.answerKey Json?` is a plain scalar column on
  `Question` (the correct-answer field consumed by grading).
- `apps/api/src/modules/tests/tests.service.ts:41-49` (`resume`):
  ```
  resume(userId: string, id: string) {
    return this.db.testAttempt.findFirst({
      where: { id, userId },
      include: {
        test: { include: { language: true, sections: { include: { passages: {...}, questions: { include: { audioFile: true }, orderBy: { order: 'asc' } } }, orderBy: { order: 'asc' } } } },
        answers: true, sectionStates: true, scores: true,
      },
    });
  }
  ```
  This uses Prisma `include` (not `select`) all the way down to `questions`, which returns
  **every scalar column of `Question`**, including `answerKey` and `scoringRule`.
- `apps/api/src/modules/tests/tests.controller.ts:16` — `GET /tests/attempts/:id` returns
  `this.s.resume(u.id, id)` directly with no response DTO/serializer stripping fields (contrast
  with `apps/api/src/modules/bookings/bookings.controller.ts:16`, which wraps output in
  `plainToInstance(BookingResponseDto, ..., { excludeExtraneousValues: true })`).
- Grading later relies on this same field for correctness: `tests.service.ts:152`
  (`this.equalJson(answer.value, answer.question.answerKey)`).

**Impact**

Any student with an `IN_PROGRESS` (or `UNDER_REVIEW`) attempt can call
`GET /api/tests/attempts/:id` at any time and read the correct answer key for every
`single_choice`/`multiple_choice`/`true_false` question in the test directly out of the JSON
response, before or while answering. This completely defeats the integrity of every objective
IELTS-style test section — a core product feature (`apps/api/src/modules/tests/*`).

**Exploit sketch**

1. Student calls `POST /api/tests/attempts` to start an attempt (`tests.controller.ts:14`).
2. Student calls `GET /api/tests/attempts/:id` (`tests.controller.ts:16`) — the response body
   contains `test.sections[].questions[].answerKey` for every question, including ones not yet
   displayed/answered.
3. Student answers using the leaked key; `submit()` (`tests.service.ts:152-153`) then scores them
   as correct.

**Minimal fix suggestion**

Change the `questions` (and ideally `passages`/`sections`) includes in `resume()` to explicit
`select` clauses that omit `answerKey` and `scoringRule` for the student-facing route, or map the
Prisma result through a response DTO before returning it (as `BookingResponseDto` already does
elsewhere in the codebase). Keep the full-field query only for the staff/examiner paths
(`ExaminerController`/`TestBuilderController` in `tests.controller.ts:22-58`, which are gated by
`@Roles('EXAMINER','ADMIN')` / `@Roles('ADMIN','STAFF')`).

---

## HIGH

### SEC-003 — Self-elevation guard only checks `userId === actorId`, so it is bypassable with a second attacker-controlled account

**Evidence**

- `apps/api/src/modules/admin/admin.service.ts:122-123` (`assignRole`) and `:148-149`
  (`grantPermission`) both gate solely on `if (userId === actorId) throw selfElevation();`. Both
  are reachable by anyone with the `roles.manage` permission and STAFF role
  (`admin.controller.ts:15,73-83`), not just ADMIN.
- Nothing in `assignRole`/`grantPermission` checks whether the **actor themself** currently holds
  `ADMIN`, only that the actor isn't literally the same row as the target.

**Impact**

Even ignoring SEC-001, the self-elevation defense described in the code comment at
`admin.service.ts:8-13` ("privilege changes must always be applied by a second person") is
structurally weaker than the comment implies: it stops direct self-targeting but not proxy
escalation. An attacker who controls (or can create) a second account can have that second
account grant the first one `ADMIN` via `assignRole`/`grantPermission`, since `userId !==
actorId` in that call. SEC-001 makes this moot in practice (one call is enough), but this is the
underlying design gap that should be fixed together with SEC-001 — patching only `createUser`
would still leave this route open.

**Exploit sketch** (independent of SEC-001, for completeness)

1. Attacker A holds `roles.manage` (STAFF).
2. A creates a second account B (`STUDENT`, no special roles) via ordinary signup/OTP, or via
   `admin.controller.ts:32-33` with only `roles:['STUDENT']` (which passes fine).
3. A calls `grantPermission(actor=A, userId=B, role='STAFF', permission='roles.manage')`
   (`admin.controller.ts:82-83`) — allowed, `B !== A`.
4. Now B also holds `roles.manage`. B calls `assignRole(actor=B, userId=A, role='ADMIN')`
   (`admin.controller.ts:74-75`) — allowed, `A !== B`. A is now ADMIN, granted by a proxy account
   A itself set up.

**Minimal fix suggestion**

Require the actor to already hold `ADMIN` (not merely a delegated permission) before
`assignRole`/`grantPermission`/`createUser` may target the `ADMIN` role at all, and/or log +
alert on role grants targeting `ADMIN`, and/or require a distinct pre-existing ADMIN approver
(four-eyes) for any grant of `ADMIN`.

---

## MEDIUM

### SEC-004 — ZarinPal payment callback endpoint has no rate limiting

**Evidence**

- `apps/api/src/modules/commerce/commerce.controller.ts:23-27`:
  ```
  @Public()
  @Get('callback')
  callback(@Query('Authority') a: string, @Query('Status') status: string) {
    return this.s.callback(a, status);
  }
  ```
  No `@RateLimit(...)` decorator, unlike the OTP/refresh routes in
  `apps/api/src/modules/auth/auth.controller.ts:11-13` which explicitly budget anonymous traffic.
- `PaymentsService.callback` (`apps/api/src/modules/commerce/payments.service.ts:173-196`) does
  a DB lookup by `authority` and, for any row in a settleable status, makes a live outbound
  request to ZarinPal (`gateway.service.ts:32-40`) to verify.

**Impact**

Because this is `@Public()` and unauthenticated by design (ZarinPal redirects browsers here), and
because every call in a settleable state triggers a real outbound HTTPS request to ZarinPal's
verify endpoint, an attacker can drive unlimited outbound API calls (cost/noise against the
ZarinPal integration, and unbounded log/DB churn) simply by replaying `GET
/api/payments/callback?Authority=<guessed>&Status=OK` — the underlying money-movement logic is
safe (verified server-side against ZarinPal, not trusted from query params — confirmed at
`payments.service.ts:179-184`), but the endpoint itself is an unmetered amplification/DoS-style
surface. This does not by itself move money (that requires a real ZarinPal-side capture) — kept
minimal per scope, this is a defense-in-depth / cost-control gap, not a payment-authorization bug.

**Minimal fix suggestion**

Add a `@RateLimit(...)` (per-IP) budget to the `callback` route, consistent with how
`auth.controller.ts` treats other public, high-value endpoints.

---

## LOW / INFORMATIONAL

### SEC-005 — Access tokens are not invalidated on suspension or role/permission change; a demoted or suspended user keeps old privileges for up to 15 minutes

**Evidence**

- `apps/api/src/common/guards/access-token.guard.ts:19-21` — only verifies the JWT signature and
  standard claims (`this.jwt.verifyAsync<AuthUser>(token)`); it never re-checks the user's current
  `status`, roles, or permissions against the database.
- `apps/api/src/modules/auth/auth.module.ts:2` — access tokens are signed with
  `signOptions:{expiresIn:'15m'}`.
- `apps/api/src/modules/admin/admin.service.ts:73-77` (`updateUserStatus`, e.g. suspending a
  user) and `:79-96` (`setUserRoles`) update the database but do not revoke any outstanding
  `RefreshSession` rows or otherwise blacklist already-issued access tokens.
- Mitigating factor (verified): `refresh()` does re-check live state —
  `apps/api/src/modules/auth/auth.service.ts:9` (`createSession`) re-reads the user afresh and
  throws `UnauthorizedException('Account unavailable')` if `status !== 'ACTIVE'`, so a suspended
  user cannot obtain a *new* access token; only their already-issued one keeps working until it
  naturally expires.

**Impact**

A user who is suspended, demoted, or has a permission revoked mid-session retains their old
`roles`/`permissions` claims (baked into the JWT at issuance, `auth.service.ts:9`) for up to 15
minutes on any request that doesn't go through `refresh`. For admin/finance-role accounts this is
a meaningful (if time-boxed) window. This is a common, often-accepted tradeoff of stateless JWT
auth, so it's flagged as low/informational rather than a hard finding — worth a conscious decision
whether 15 minutes is acceptable for this app's most sensitive roles (FINANCE/ADMIN).

**Minimal fix suggestion**

For high-privilege roles specifically, consider a short-lived session-validity check (e.g. a
Redis-backed revocation list keyed by `sessionId`, checked in `AccessGuard`) so suspension/role
changes take effect immediately rather than waiting for token expiry.

---

### SEC-006 — CSP `connect-src`/`media-src` allow any HTTPS/HTTP origin, diluting the nonce-based `script-src` protection

**Evidence**

- `apps/web/src/middleware.ts:22-23`:
  ```
  "media-src 'self' blob: https: http:",
  "connect-src 'self' https: http:",
  ```
- The surrounding comment (`middleware.ts:6-9`) documents this as a deliberate, temporary
  tradeoff pending a dedicated `NEXT_PUBLIC_*` var for the S3/MinIO origin.

**Impact**

The strict nonce + `strict-dynamic` `script-src` (`middleware.ts:18`) is the primary defense
against token exfiltration via injected scripts, and it is correctly scoped. However, because
`connect-src`/`media-src` accept **any** HTTP/HTTPS origin, if an attacker ever did get a script
to execute (e.g. via a dependency compromise that reuses an already-trusted `nonce`-bearing
`<script>` tag, or a `strict-dynamic` gadget), data exfiltration via `fetch`/`XHR`/`<img>`/`<audio>`
to an arbitrary attacker-controlled origin would not be blocked by CSP. This is already documented
as intentional/temporary by the authors, so it's recorded here as informational, not a new
discovery — but it should be tightened once the presigned-URL origin is exposed via an env var, as
the comment itself says.

**Minimal fix suggestion**

Track down to the actual S3/MinIO origin(s) via a build-time `NEXT_PUBLIC_S3_ORIGIN` (or similar)
and replace the blanket `https: http:` with that specific origin allowlist, as the code comment
already proposes.

---

### SEC-007 — OTP codes are hashed with unsalted SHA-256 rather than a slow/keyed hash

**Evidence**

- `apps/api/src/modules/auth/auth.service.ts:5` — `const hash=(s:string)=>createHash('sha256').update(s).digest('hex');`
- Used for OTP storage at `auth.service.ts:7` (`codeHash:hash(code)`) and compared with
  `timingSafeEqual` at `auth.service.ts:8`.
- Mitigating factors (verified in the same file): codes are 6-digit random via
  `randomInt(100000,1000000)` (`auth.service.ts:7`), expire in 2 minutes (`expiresAt`), are
  single-use (`challenge.verifiedAt` checked at `auth.service.ts:8`), and are attempt-limited to 5
  tries (`auth.service.ts:8`, `challenge.attempts>=5`).

**Impact**

Given the code space (900,000 possibilities), 2-minute TTL, single-use enforcement, and 5-attempt
cap, an unsalted fast hash is a low-risk choice here — this is not comparable to password storage.
It is flagged only because item 11 of the audit checklist explicitly calls for a check on OTP
hashing: there is no bcrypt/argon2 in use (see SEC-008 — `bcryptjs` is an unused dependency, not
what protects the OTP), and a salt/pepper would still be a defense-in-depth improvement in case
the `OtpChallenge` table were ever exposed via a separate read-only vector (e.g. a future reporting
export) — a plain SHA-256 rainbow table over 900,000 6-digit codes is trivial to precompute.

**Minimal fix suggestion**

Add an application-level pepper (HMAC-SHA256 with a server-side secret) to the OTP hash so a raw
table dump doesn't trivially recover codes still inside their 2-minute validity window. Not
urgent given the existing mitigations.

---

### SEC-008 — `bcryptjs` is a declared dependency in `apps/api` but is not used anywhere in `apps/api/src`

**Evidence**

- `apps/api/package.json:28` — `"bcryptjs": "^2.4.3"`.
- `grep -rn "bcrypt" apps/api/src` returns no matches outside `package.json`.

**Impact**

None directly (dead dependency, not a vulnerability by itself), but it confirms the depcheck
finding referenced in the audit brief: there is no password hashing anywhere in `apps/api` (auth
is phone+OTP, per CLAUDE.md), and OTP hashing uses plain `sha256` (see SEC-007), not `bcryptjs`.
Recorded here so it isn't mistaken for OTP protection.

**Minimal fix suggestion**

Remove the unused dependency, or use it (e.g. as the pepper mechanism suggested in SEC-007) if it
was intended for some hashing path.

---

### SEC-009 — `x-request-id` response header echoes an unvalidated client-supplied value

**Evidence**

- `apps/api/src/common/http.ts:90-96` (`RequestIdMiddleware`):
  ```
  use(req: Request, res: Response, next: NextFunction) {
    const id = String(req.headers['x-request-id'] ?? randomUUID());
    res.setHeader('x-request-id', id);
    ...
  }
  ```

**Impact**

Any client can set `x-request-id` to an arbitrary string and have it reflected back verbatim in
the response header on every request, with no length cap or character allowlist. Express's
`setHeader` will throw on embedded CR/LF (blocking classic header injection), but there is no
positive validation (e.g. length limit, safe-charset check), so this remains a minor
correlation/log-hygiene concern (a client can inject arbitrary strings into logs and downstream
tracing systems that key off this header) rather than an exploitable vulnerability.

**Minimal fix suggestion**

Only trust `x-request-id` from trusted upstream proxies, or validate it against a safe pattern
(e.g. UUID-like) before reflecting it, falling back to `randomUUID()` otherwise.

---

### SEC-010 — `DiscountDto` has no upper bound on `value`/no enum on `type` (admin/finance-only endpoint, low real-world impact)

**Evidence**

- `apps/api/src/modules/commerce/dto/request/discount.dto.ts:5-6`:
  `@IsString() type!: string;` and `@IsInt() @Min(1) value!: number;` — no `@Max`, no
  `@IsIn(['percent','fixed'])`.
- Consumed at `apps/api/src/modules/commerce/payments.service.ts:86` —
  `discount.type === 'percent' ? ... : discount.value` — any `type` other than the literal string
  `'percent'` silently falls into the "fixed amount" branch.
- Reachable only via `apps/api/src/modules/commerce/payouts.controller.ts:35-38`, gated by
  class-level `@Roles('ADMIN','FINANCE')` + `@Permissions('payouts.manage')`
  (`payouts.controller.ts:9-10`).

**Impact**

Low: only trusted ADMIN/FINANCE actors can create discounts, so this is not attacker-reachable
under the current role model. Recorded for completeness per the mass-assignment/DTO-validation
checklist item; a typo'd `type` (e.g. `"percentage"` instead of `"percent"`) would silently create
a huge fixed-amount discount rather than being rejected at the validation layer.

**Minimal fix suggestion**

Add `@IsIn(['percent','fixed'])` to `type` and a sane `@Max(...)` to `value`.

---

## Checklist items reviewed with no finding (verified, not just assumed)

- **JWT verification**: `apps/api/src/common/guards/access-token.guard.ts:19-21` verifies via the
  same `JWT_ACCESS_SECRET`-keyed `JwtService` used to sign
  (`apps/api/src/modules/auth/auth.module.ts:2`); tokens carry a 15-minute `exp`
  (`auth.module.ts:2`) which `verifyAsync` enforces. `apps/api/src/app.module.ts:2` also
  registers a second, module-global `JwtModule.register({global:true,secret:process.env.JWT_ACCESS_SECRET})`
  with no `signOptions`, but this instance is only used for verification by `AccessGuard`
  (declared directly on `AppModule`), and JWT `exp` validation does not depend on the verifier's
  `signOptions` — only on the `exp` claim embedded at signing time, which the `AuthModule`-scoped
  `JwtService` does set. Both `JwtService` instances resolve the same secret value because
  `apps/api/src/env.ts:11-15` loads `.env` into `process.env` before either
  `process.env.JWT_ACCESS_SECRET` (`app.module.ts:2`) or `config().JWT_ACCESS_SECRET`
  (`apps/api/src/config/index.ts:6-9`, via `auth.module.ts:2`) is read.
- **Refresh rotation + reuse detection**: `apps/api/src/modules/auth/auth.service.ts:10` (`refresh`)
  detects a reused/invalid secret and revokes the whole token family
  (`revokeFamily`, `auth.service.ts:11`) before throwing.
- **OTP entropy**: `randomInt(100000,1000000)` via Node `crypto`, not `Math.random`
  (`auth.service.ts:7`) — confirmed.
- **Prisma injection**: only one `$queryRaw` in the entire API, a static tagged template with no
  interpolation (`apps/api/src/health.ts:61`, `SELECT 1`). No `$queryRawUnsafe`/`$executeRawUnsafe`
  anywhere in `apps/api/src`.
- **Mass assignment**: global `ValidationPipe({whitelist:true, forbidNonWhitelisted:true,
  transform:true})` (`apps/api/src/main.ts:22`) applies to all standard DTO-typed routes. The one
  deliberate exception, `TestBuilderController` (`apps/api/src/modules/tests/tests.controller.ts:31-58`,
  bodies typed `unknown`), was manually audited: every write path
  (`definitionData`/`sectionData`/`questionData`/etc., `tests.service.ts:291-338`) whitelists
  fields individually rather than spreading the raw body into Prisma `data:`.
- **IDOR — bookings**: `cancel` (`bookings.service.ts:202`), `partyOn` (`bookings.service.ts:238-245`),
  `attendance`/`complete` (`bookings.service.ts:365-410`) all check the caller against
  `booking.studentId`/`booking.teacher.userId` (or staff role) before acting.
- **IDOR — commerce**: `createPayment`/`assertOwned` (`payments.service.ts:23-52`),
  `gatewayRedirect` (`payments.service.ts:156-161`, scoped by `userId` in the `findFirstOrThrow`
  where-clause), `teacherFinance`/`requestWithdrawal` (`payouts.service.ts:95-120`, scoped by
  `where:{userId}`) all enforce ownership.
- **IDOR — support/tickets**: `list`/`detail`/`reply` (`support.service.ts:28-120`) all scope to
  `userId` unless the caller is staff.
- **IDOR — files**: upload/content/complete/download all filter by `ownerId: requesterId`
  (`files.service.ts:74,91,116-128`), plus a reviewer-role carve-out scoped to verification/exam
  contexts, not a blanket bypass.
- **Webhook (ZarinPal callback)**: `commerce.controller.ts:23-27` is `@Public()` by necessity, but
  `PaymentsService.callback` (`payments.service.ts:173-196`) never trusts the `Status` query
  param for anything beyond a fast-fail; the actual capture is confirmed via a server-to-server
  `gateway.verify()` call against ZarinPal using the amount stored on the `Payment` row, not from
  the request (`gateway.service.ts:32-40`). Dev-mode auto-accept (`gateway.service.ts:34`) is
  gated by `!merchantId`, and production startup fails without
  `ZARINPAL_MERCHANT_ID` (`env.validation.ts:51-57`), so this path cannot activate in production.
  (Rate limiting on this endpoint is missing — see SEC-004.)
- **SSRF**: the only outbound `fetch` calls found are to fixed, hardcoded provider hosts
  (`api.kavenegar.com` in `sms.service.ts:7`, `queue.service.ts:65`, `support.service.ts:194`;
  ZarinPal's fixed sandbox/production hosts in `gateway.service.ts:17-18`) — none take a
  user-controlled URL or hostname.
- **Path traversal / upload validation**: `files.service.ts:10-23` whitelists MIME types,
  `:49-56` caps size at 50MB, `:57-59` requires a well-formed SHA-256 checksum, `:60` sanitizes
  the extension to `[a-z0-9]`, and the S3 key is built from `ownerId`/`randomUUID()` — the S3
  key itself is not derived from any client-controlled path segment. `complete()`
  (`files.service.ts:90-112`) re-verifies size/type/checksum against the object actually stored
  in S3 before marking a file `SAFE`, and quarantines mismatches.
- **Leaks (`ApiExceptionFilter`)**: `apps/api/src/common/http.ts:44-86` only sends the mapped
  `DomainException` body to the client; raw errors/stack traces are logged server-side only
  (`http.ts:56-59`, `this.log.error(...)`) and never included in the JSON response. 5xx responses
  fall back to the generic `'Internal server error'`/localized equivalent
  (`errors.ts` legacy map at `http.ts:19`), not the underlying exception message.
- **Deps (npm audit)**: `AUDIT/npm-audit.json` lists exactly two advisories, both `high`: `next`
  (direct, `apps/web`) and `sharp` (transitive via `next`, `apps/web`). Neither package appears in
  `apps/api/package.json`; `sharp`'s `effects` field in the audit report lists only `next`,
  confirming it is not reachable from `apps/api`.
- **Route authorization allow-list (web)**: `apps/web/src/lib/panel-access.ts:36-49` is a
  default-deny explicit allow-list with narrower `/admin/*` patterns ordered before the
  `/admin` catch-all (`:37-42` before `:42`), matching the CLAUDE.md description. This is
  client-side UX gating only — actual authorization is enforced API-side by the guards reviewed
  above.
