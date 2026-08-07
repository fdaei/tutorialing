# Phase 2 — Security audit

Route × role matrix built by parsing every controller; full table in
`scratchpad/route-matrix.md`. **139 routes, 14 public, 125 authenticated.**

> **Parser correction worth recording.** My first matrix reported 143 routes and 63 unscoped, and
> flagged `POST /languages` / `DELETE /tests/:id` as unguarded. That was wrong: several files declare
> **two** controller classes (e.g. `LanguagesController` at `/languages` *and*
> `AdminLanguagesController` at `/admin/languages` with class-level `@Roles('ADMIN','STAFF')`), and
> the first parser read only the first `@Controller` per file. Corrected numbers are above. The
> lesson generalises — class-level decorators are the norm in this codebase, so any route audit that
> only looks at method decorators will produce false positives.

---

## 2.1 OWASP Top 10 (2021) coverage

| # | Category | Status | Evidence |
|---|---|---|---|
| A01 | Broken access control | **PASS** | Global `AccessGuard` + `AuthorizationGuard`. 42 authenticated-unscoped routes are all self-scoped resources, each verified to filter by owner at the service layer (§2.2). |
| A02 | Cryptographic failures | **PASS** | OTP HMAC-SHA256 under a pepper; refresh secret 32 random bytes; no passwords exist (OTP-only). Cookies `httpOnly`, `secure` in production, `sameSite:lax`, `path:/api/auth`. |
| A03 | Injection | **PASS** | Prisma parameterised throughout. Only raw SQL is `$queryRaw\`SELECT 1\`` (`health.ts:61`) — no interpolation. One `dangerouslySetInnerHTML`, fed from a build-time env var (SEC-204). No `eval` of user input. |
| A04 | Insecure design | **PASS** | Verify-before-grant, append-only ledger, Serializable on every money read-then-write (Phase 1). |
| A05 | Security misconfiguration | **PASS** | `helmet()` at `main.ts:20`; CORS `origin: cfg.WEB_URL, credentials:true` — a single allowlisted origin, never `*`. Swagger registered only when `NODE_ENV !== 'production'`. Startup aborts if `AUTH_DEV_OTP` is combined with production. |
| A06 | Vulnerable components | **FAIL** | 7 high advisories, 5 reachable in production dependencies. **SEC-201**. |
| A07 | Auth failures | **PASS** | §2.3. |
| A08 | Integrity failures | **PASS** | Upload checksum validated `^[a-f0-9]{64}$`; storage key never user-controlled. |
| A09 | Logging failures | **PASS (partial)** | `AuditService` records privileged actions; `RequestIdMiddleware` correlates. No OTP, token, or secret found in any log call. No centralised log shipping — noted in Phase 7 backlog. |
| A10 | SSRF | **PASS** | The only server-side fetches are to Zarinpal and Kavenegar, both from config constants — no user-supplied URL is ever fetched. `safeInternalPath()` guards `?next=` redirects against protocol-relative URLs, traversal and control characters. |

---

## 2.2 Object-level authorization (IDOR)

The 42 authenticated-but-unscoped routes carry no `@Roles`/`@Permissions` **by design** — they are
self-scoped resources where the owner check belongs in the service. Each family verified:

| Family | Scoping mechanism | Verdict |
|---|---|---|
| `/users/me/*` | `@CurrentUser()` id used directly; no id ever taken from the path | PASS |
| `/bookings/*` | `booking.studentId !== userId` → 404 (`payments.service.ts:61`); cancel/reschedule re-check party | PASS |
| `/payments/wallet`, `/invoices` | `where: { userId }` (`wallet.service.ts:16,26`) | PASS |
| `/files/*` | `ownerId` on create/upload/complete; `download()` matches `ownerId: requesterId` or an explicit role branch (`files.service.ts:74,91,114-121`) | PASS |
| `/support/tickets/*` | `staff ? {} : { userId }` (`support.service.ts:31`) | PASS |
| `/tests/attempts/*` | attempt ownership checked in service before read/write | PASS |
| `/teacher/application` | keyed on the caller's own teacher record | PASS |

**No IDOR found.** Notably, unauthorized access returns **404, not 403**, so the endpoints do not
double as existence oracles.

### Mass assignment — PASS

Global `ValidationPipe` runs `whitelist: true, forbidNonWhitelisted: true`, so unknown properties are
rejected outright. `ProfileDto` exposes only `name`, `email`, `locale`, `timezone`, `birthDate` —
no `role`, `status`, `balance`, or `verified`. Privilege escalation is separately blocked at the
service layer (`assignRole`/`grantPermission`/`setUserRoles` reject `userId === actorId`).

---

## 2.3 Authentication

| Control | Implementation | Verdict |
|---|---|---|
| Credential model | Phone + OTP only; no passwords stored anywhere | PASS |
| OTP entropy | `randomInt(100000, 1000000)` — CSPRNG, 900k space | PASS |
| OTP storage | HMAC-SHA256 under a pepper derived from `JWT_ACCESS_SECRET` | PASS |
| OTP expiry | 120 s; resend gated to 60 s | PASS |
| Rate limit / phone | `resendAfter` + max 5 per rolling hour (`auth.service.ts:26`) | PASS |
| Rate limit / IP | `@RateLimit(OTP_SEND_LIMIT)` on request/resend, sharing one bucket so the two cannot be alternated | PASS |
| Enumeration | `requestOtp` **upserts** the user, so response shape is identical for known and unknown numbers | PASS |
| Access token | 15 min, `sessionId` embedded | PASS |
| Refresh token | `sessionId.secret`, 32 random bytes, SHA-256 stored, 30 d, `familyId` for reuse detection | PASS |
| Revocation | `TokenRevocationService` marker; `AccessGuard` rejects tokens with `iat` at or before it | PASS |
| Algorithm confusion | **was unpinned** — fixed, see SEC-203 | FIXED |

`AccessGuard` fails **closed** for ADMIN/FINANCE/STAFF/SUPPORT/EXAMINER and **open** for ordinary
users when Redis is unavailable — a deliberate trade documented by the original team, and correct:
failing closed for everyone would convert a Redis blip into a total outage.

---

## 2.4 Findings

### SEC-201 — Seven high-severity dependency advisories, five reachable in production — **HIGH — OPEN**

`npm audit`: **7 high, 0 critical**. With `--omit=dev`: **5 high** — `next`, `sharp`, `nanoid`,
`@nestjs/swagger`, `js-yaml`. (`brace-expansion` and `fast-uri` are dev-only.)

The prior audit recorded "2 high (next.js/sharp), confirmed unreachable from `apps/api`". That is
**no longer accurate**: `@nestjs/swagger` → `js-yaml` sits in the **API's** production tree.

Next.js alone carries eight advisories, including:

- SSRF in rewrites via attacker-controlled destination hostname
- Unauthenticated disclosure of internal Server Function endpoints
- Cache confusion of response bodies for requests with bodies
- DoS in the Image Optimization API using SVGs

**Relevance check.** `middleware.ts` *does* use `rewrite()`, but the destination is derived from the
request's own pathname (`/en/x` → `/x`), never from an attacker-supplied hostname — so the SSRF
variant is not reachable as written. The remaining advisories are not individually excluded and need
the version bump.

`js-yaml` is reached only through Swagger, which `main.ts` registers **only when
`NODE_ENV !== 'production'`** — so the parser is not exercised in a production process, though the
package is still installed.

**Fix path:** Next.js major-version bump (see `SECURITY.md` for why Next 16 was deferred).
Deliberately **not** attempted here — ground rule 3 forbids unrequested dependency upgrades, and a
major bump is its own scoped project with its own regression surface.

### SEC-202 — Upload MIME type is client-declared, never content-sniffed — **MEDIUM — OPEN**

`files.service.ts:41` validates `data.mimeType` against an allowlist, but that value comes from the
request body. Nothing inspects the bytes. A caller can declare `image/png` and store arbitrary
content; the presigned `PutObjectCommand` then sets that same declared `ContentType` on the object.

**Impact is bounded but real:** objects live in MinIO/S3 on a separate origin from the app, so this
is not same-origin XSS against LingoSpeak, and the storage key is never user-controlled (no
traversal, no executable path). The exposure is a stored HTML/SVG payload served from the storage
origin under an attacker-chosen content type.

**Fix (not applied):** sniff the leading magic bytes in `uploadContent`/`complete` and reject on
mismatch with the declared type. Deferred as it needs a sniffing dependency or a hand-rolled table —
a scoped change rather than a one-liner.

### SEC-203 — JWT verification had no algorithm allowlist — **LOW — FIXED**

`access-token.guard.ts:37` called `verifyAsync(token)` with no `algorithms` option.

**Not exploitable as configured**: the key is symmetric, so no RS256 forgery is possible, and
`jsonwebtoken` already refuses `alg: none` unless explicitly permitted. Fixed anyway because leaving
the allowlist open means any future migration to an asymmetric key silently reintroduces the
algorithm-confusion attack. Now pinned to `['HS256']`.

### SEC-204 — `dangerouslySetInnerHTML` for the Enamad seal — **LOW — ACCEPTED**

`site.tsx:37` injects `process.env.NEXT_PUBLIC_ENAMAD_HTML` verbatim. The value is a build-time,
operator-controlled env var, not user input, and Enamad genuinely issues an HTML snippet — there is
no reasonable alternative. Documented in the component. **Accepted risk**, conditional on operators
pasting only the snippet Enamad issued.

### SEC-205 — `/bookings` state-changing routes had no rate limit — **MEDIUM — FIXED**

All nine `/bookings` routes were unthrottled. Booking creation takes a Redis slot lock and runs a
Serializable transaction, so an unthrottled caller could both squat every slot a teacher has (each
booking sits in `PENDING_PAYMENT` until expiry) and force repeated serialization conflicts against
legitimate bookers.

Fixed: `moneyAdjacent` tier (30 / 10 min) applied to `POST /bookings`, `POST /bookings/:id/cancel`,
and `POST /bookings/:id/reschedule`. Read routes and the two-party accept/decline routes are left
unthrottled deliberately — they cannot allocate a slot.

---

## 2.5 Remediation order

1. **SEC-201** — Next.js bump. Highest severity, largest blast radius, needs its own project.
2. **SEC-202** — content sniffing on upload.
3. ~~SEC-205~~ — done.
4. ~~SEC-203~~ — done.
5. **SEC-204** — accepted; revisit only if the snippet ever becomes user-supplied.

## 2.6 Summary

| Severity | Count | IDs |
|---|---|---|
| HIGH | 1 | SEC-201 (open) |
| MEDIUM | 2 | SEC-202 (open), SEC-205 (**fixed**) |
| LOW | 2 | SEC-203 (**fixed**), SEC-204 (accepted) |

No critical findings. No injection, no IDOR, no mass assignment, no committed secrets
(`git log --diff-filter=A` over all history finds no `.env`, key, or credential file ever added).
Nine of ten OWASP categories PASS; A06 fails solely on dependency currency.
