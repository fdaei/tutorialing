# Messaging infrastructure implementation

Date: 2026-08-26. Chosen architecture: **B — narrow messaging infrastructure**. No standalone domain-level `NotificationModule` was created.

## Migration performed

- Added a provider-neutral `SmsProvider` contract and injection token under `src/infrastructure/messaging`.
- Added `KavenegarProvider`, the only code that knows the Kavenegar endpoint shape, credential placement, HTTP response, timeout, and provider-specific failure normalization.
- Added global `MessagingModule` through the existing global `InfrastructureModule`.
- Replaced direct Kavenegar HTTP calls in Auth OTP, BullMQ booking reminders, and Support assignment SMS.
- Added a 10-second provider timeout and normalized failure codes: `NOT_CONFIGURED`, `TIMEOUT`, `NETWORK_ERROR`, `REJECTED`, and `INVALID_RESPONSE`.
- Added structured, payload-safe delivery logs containing channel, provider, masked recipient, duration, success, and normalized failure code. OTPs, message tokens, credentials, payloads, and raw responses are not logged.

Dependency direction:

`Auth SmsService / QueueService / SupportService -> SmsProvider -> KavenegarProvider`

## Preserved behavior and boundaries

- Auth still generates, hashes, persists, rate-limits, expires, and verifies OTPs. Infrastructure only transports the code.
- OTP remains synchronous and fail-closed. A provider failure becomes the same 503 and no sent delivery record is created.
- Development OTP echo still requires `AUTH_DEV_OTP`; production validation remains unchanged.
- Reminder delivery remains BullMQ-backed with the existing five attempts, idempotency key, delivery state, and job failure semantics.
- Ticket assignment SMS remains preference-gated, best-effort, post-transaction, recorded on failure, and not retried.
- Existing Persian/English notification copy, Kavenegar templates, provider-response persistence, and database schema are unchanged.

## Tests

- `kavenegar.provider.spec.ts`: token encoding, provider-neutral success result, rejected response, invalid JSON, and timeout normalization.
- `sms.service.spec.ts`: successful synchronous OTP delivery, provider failure, and missing-provider production-style fail-closed behavior.
- Existing Support fixtures now supply the provider contract; workflow behavior remains covered.
- `architecture.spec.ts` now rejects concrete Kavenegar provider imports from feature modules.

Final gate: API typecheck, lint, production build, and all 44 API unit/architecture/authorization suites passed (291/291 tests). Web code was not changed, so web tests were not rerun. TEST-001 is an E2E-only pre-existing issue and was not encountered or modified.

## Explicitly deferred

Email, push, a generic notification dispatcher, template registry, domain events, an outbox, new queue behavior, notification persistence redesign, preference redesign, and changes to transaction/failure semantics were not implemented.
