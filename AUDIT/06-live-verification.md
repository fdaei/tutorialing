# Phase 6 — Live verification

Run against a **running stack**, not a mock: PostgreSQL 16, Redis, MinIO (all healthy in Docker),
NestJS API on `:4001` with `/api` prefix, 11 migrations applied, seed data loaded.

```
tutorialing-postgres-1   Up (healthy)
tutorialing-redis-1      Up (healthy)
tutorialing-minio-1      Up (healthy)
GET /api/health -> {"status":"ok","database":"connected","cache":"connected"}
```

---

## 6.1 Startup procedure (verified working)

```bash
npm run services:up     # postgres + redis + minio, waits healthy, creates bucket
npm run db:prepare      # prisma generate + validate + migrate deploy + seed
npm run start:dev -w @lingospeak/api      # API on :4001
npm run dev             # web on :3000
```

`db:prepare` reported *"11 migrations found / No pending migrations to apply"* and the seed
completed with exit 0.

---

## 6.2 Flow results

| # | Flow | Expected | Actual | Result |
|---|---|---|---|---|
| 1 | `GET /api/health` | ok, db + cache connected | exactly that | **PASS** |
| 2 | `GET /api/teachers` (public) | seeded teachers | 10 teachers, Persian + Latin names, prices | **PASS** |
| 3 | `GET /api/languages` (public) | multi-language reference data | en, de, es… with `direction`, CEFR | **PASS** |
| 4 | OTP request → verify → token | access token issued | JWT with roles + sessionId | **PASS** |
| 5 | `GET /api/users/me` | own profile only | `user-student-completed`, Persian name | **PASS** |
| 6 | `GET /api/bookings/me` | own bookings | completed booking with teacher detail | **PASS** |
| 7 | `GET /api/payments/wallet` | own balance | `{"balance":0}` | **PASS** |
| 8 | No token → protected route | 401 | 401 | **PASS** |
| 9 | Student → `/api/admin/payments` | 403 | 403 | **PASS** |
| 10 | Admin → `/api/admin/payments` | 200 | 200 | **PASS** |
| 11 | Booking without `policyAccepted` | validation error | localized `VALIDATION_ERROR` + field error + `requestId` | **PASS** |
| 12 | Trial when one already used | business rule blocks | `TRIAL_ALREADY_USED` (fa + field hint) | **PASS** |
| 13 | Regular before trial completed | business rule blocks | `TRIAL_SESSION_REQUIRED` | **PASS** |
| 14 | Create booking on free slot | `PENDING_PAYMENT` | `PENDING_PAYMENT` | **PASS** |
| 15 | **IDOR — student B pays student A's booking** | 404 | **404** | **PASS** |
| 16 | Owner creates payment | amount from DB | `subtotal 270000 = teacher trialPrice`, `amount 270000`, `gatewayAmount 270000` | **PASS** |
| 17 | **Replay same `idempotencyKey`** | same payment row | **same id returned** | **PASS** |
| 18 | Gateway redirect | one authority + URL | real Zarinpal sandbox authority `S0000…d82l83` | **PASS** |
| 19 | **3 concurrent gateway redirects (FIN-002)** | only one session | 2× `PAYMENT_GATEWAY_BUSY`, one winner | **PASS** |
| 20 | **Callback for an unpaid authority** | must NOT grant | payment → `FAILED`, booking stays `PENDING_PAYMENT` | **PASS** |
| 21 | Replayed callback | idempotent, no crash | 200 | **PASS** |
| 22 | OTP rate limit | 429 + headers | `429`, `RateLimit-Limit: 10`, `Remaining: 0`, `Retry-After: 41` | **PASS** |

**22 flows, 22 PASS, 0 FAIL.**

---

## 6.3 The two results that matter most

### Verify-before-grant proven against a real gateway (flow 20)

This is the single most important security property of the payment system, and it was tested the
only way that counts — by trying to cheat it.

The API opened a genuine Zarinpal **sandbox** session and returned authority
`S00000000000000000000000000000d82l83`. **No payment was ever made at Zarinpal.** The callback was
then invoked directly with `Status=OK` — exactly what an attacker who guessed or replayed a callback
URL would send.

The result:

```
payment  cmska16j4001xoc944nmw2090   FAILED   270000   gatewayReference: None
booking  cmska16fo001voc94o56vgpbm   PENDING_PAYMENT
```

The API **ignored the `Status=OK` in the callback**, asked Zarinpal directly whether the money was
captured, was told no, and refused to grant the lesson. A forged "payment succeeded" callback buys
nothing. This is the behaviour §1.3 claimed from reading the code — now demonstrated end to end.

### Duplicate gateway sessions blocked under real concurrency (flow 19)

Three simultaneous `POST /payments/:id/gateway` calls for one payment produced **one** authority;
the other two were rejected with `PAYMENT_GATEWAY_BUSY`. FIN-002's lock holds under actual parallel
requests, not just in a unit test — this was the finding the prior audit had reproduced live before
its fix, and it remains closed.

### IDOR blocked live (flow 15)

Student B, holding a valid token, attempted to create a payment against Student A's booking id and
received **404** — not 403, so the endpoint does not confirm the booking exists.

---

## 6.4 Rate limiting observed working (and it interrupted this audit)

Mid-walkthrough, logins began failing with **429**. Response headers:

```
RateLimit-Limit: 10
RateLimit-Remaining: 0
RateLimit-Reset: 41
Retry-After: 41
```

A *fresh, unseeded* phone number received the same 429 and the same reset, which proves the limit
that fired was the **per-IP** bucket (`auth:otp-send`, 10 per 600s), not the per-phone one. Both
layers exist and both were observed: per-phone (5/hour, `OTP_HOURLY_LIMIT`) and per-IP.

This also confirms **RATE-007** (the `RateLimit-*` response headers) live.

Worth stating plainly: the rate limiter was effective enough to block the auditor for several
minutes. That is the correct outcome.

---

## 6.5 Not verified

| Item | Why | Status |
|---|---|---|
| Successful paid path end to end | Needs a human to complete payment on the Zarinpal sandbox page; cannot be scripted | **VERIFIED: NO** |
| Refund flow live | Requires a `PAID` payment, which needs the above | **VERIFIED: NO** |
| Teacher payout / withdrawal live | Same dependency | **VERIFIED: NO** |
| Web UI in browser, both locales | No browser driver run this pass; Playwright specs exist but were not executed | **VERIFIED: NO** |
| Screenshot matrix (screen × locale × breakpoint) | Not produced | **VERIFIED: NO** |
| Browser console clean | Not observed | **VERIFIED: NO** |
| Reconciliation sweep against a live gateway | Needs a real `ZARINPAL_MERCHANT_ID` | **VERIFIED: NO** (inherited gap) |

The failure path is fully verified; the **success** path is not. That asymmetry is honest and worth
repeating: I proved the system correctly refuses to grant a lesson for money it did not receive. I
did **not** prove it grants one when money *is* received — that requires a human at the sandbox
checkout page.

---

## 6.6 Server log check

`api.log` during the walkthrough contained no unhandled exceptions or stack traces. TypeScript
watch reported `Found 0 errors`. Every error response observed was a deliberate, structured,
localized API error carrying a `requestId` — e.g.

```json
{"statusCode":409,"code":"TRIAL_ALREADY_USED",
 "message":"شما قبلاً با این مدرس جلسه آزمایشی داشته‌اید…",
 "fieldErrors":{"type":"«کلاس عادی» را انتخاب کنید."},
 "locale":"fa","requestId":"b9d9814e-…"}
```

Machine-readable `code`, human message in the caller's locale, per-field hints, and a correlation id
— the error contract Prompt 2's Phase D asks for already exists and works.
