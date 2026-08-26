# Notification architecture review

Date: 2026-08-26. Scope: repository state during Phase 3 Batch 2 review. The uncommitted performance work was treated as pre-existing and was not changed.

## Executive decision

**B — BUILD NARROW MESSAGING INFRASTRUCTURE.** A broad `NotificationModule` is not justified yet. The application has a real notification data model and many in-app producers, but their wording, recipients, transaction semantics, and authorization are domain policy. Centralizing those decisions now would create a large cross-domain service, force a new transaction API, or require events/outbox semantics that the product has not approved.

The concrete shared mechanism is SMS delivery: Auth, Queue, and Support contained equivalent hand-built Kavenegar HTTP calls. A provider-neutral SMS contract in `infrastructure/messaging` fits the established dependency direction (`modules -> infrastructure`) and removes provider leakage without changing business behavior. This scoped design was implemented.

## Current architecture

- `app.module.ts` is the composition root. Feature modules live under `src/modules`; external adapters live under `src/infrastructure`; globally shared framework services live under `src/common`.
- `InfrastructureModule` is global and already exports Prisma and Redis downward to features. It is the natural home for provider adapters.
- `architecture.spec.ts` prevents deep cross-feature imports and feature dependencies from `common`. There was no notification-specific boundary before this review.
- `AuthModule` owns `AuthService` and its OTP delivery coordinator, `SmsService`. OTP generation, HMAC hashing, challenge persistence, expiry, rate/attempt limits, verification, and session creation remain entirely in Auth.
- Prisma already defines `Notification`, `NotificationDelivery`, `NotificationPreference`, and channels `IN_APP | SMS`. `SupportService` exposes the user notification read/read-mark API, while notification writes occur in Auth, Bookings, Commerce, Queue, Support, Teachers, and Tests.
- BullMQ and Redis already exist. The `notifications` queue handles booking expiration and booking reminders. Reminder jobs have five attempts with exponential backoff. There is no general event bus or outbox.
- Configuration is Zod-validated. Production requires a Kavenegar key and forbids development OTP. Application logging uses Nest `Logger` over the Pino adapter.
- No email sender, push provider, WebSocket notification transport, or email/push channel exists. User email fields and UI notification pages are not outbound email implementations.

## Actual outbound communication inventory

“Transaction dependency” describes current behavior, not an idealized target. Most in-app rows created inside a Prisma transaction cause that transaction to fail if the insert fails; rows created after a domain update can instead leave the update committed without a notification.

| Caller / type | Purpose and recipient | Channel / provider | Execution class | Criticality and failure semantics | Retry / security |
|---|---|---|---|---|---|
| Auth `SmsService`: `otp` | Login code to the requesting phone/user | SMS / Kavenegar lookup | **CRITICAL_SYNC** | Request waits for provider acceptance. Provider/config failure returns 503 and no “sent” notification is recorded. The OTP challenge is already persisted, so it is not rolled back. | No retry. Highest sensitivity; code is never logged and remains Auth-owned. Dev code is returned only with `AUTH_DEV_OTP`. |
| Queue: `class-reminder` | 24h/1h reminder to student and teacher | IN_APP + SMS / Kavenegar | **ASYNC_CANDIDATE (already async)** | BullMQ worker persists per-recipient in-app notification and delivery state. Any SMS failure leaves reminder `scheduled` and throws the job. | Five exponential retries; notification idempotency key and sent-SMS short circuit. Contains schedule/phone PII. |
| Support: `TICKET_ASSIGNED` | Assignment to support assignee | IN_APP, optional SMS / Kavenegar | **BEST_EFFORT SMS** | Assignment and in-app row commit first. SMS is attempted afterward only if preference is not `sms=false`; failure is recorded and swallowed, so assignment never rolls back. | No retry. Ticket suffix only is sent as provider token. |
| Support: `TICKET_REPLY` | New non-internal reply to ticket owner, assignee, or all active support staff when unassigned | IN_APP / database | Synchronous | Created inside reply transaction; notification insert failure rolls back reply/status. | No retry/dedupe. May contain ticket subject. |
| Support: `TICKET_STATUS_CHANGED` | Status change to ticket owner | IN_APP / database | Synchronous | Created inside status transaction; failure rolls back status/history/system reply. No explicit delivery row. | No retry/dedupe. |
| Bookings: `BOOKING_RESCHEDULE_REQUESTED` | Proposal to booking counterparty | IN_APP / database | Synchronous after booking update | Notification failure does **not** roll back the already-written proposal because calls are not in one transaction. | No retry/dedupe. |
| Bookings: `BOOKING_RESCHEDULE_ACCEPTED` | Acceptance to original proposer | IN_APP / database | Synchronous after booking transaction and queue schedule | Notification failure leaves booking moved and reminders scheduled. | No retry/dedupe. |
| Bookings: `BOOKING_RESCHEDULE_DECLINED` | Decline to original proposer | IN_APP / database | Synchronous after booking update | Notification failure leaves proposal cleared. | No retry/dedupe. |
| Bookings: `BOOKING_REVIEW_REQUEST` | Review prompt to student after paid lesson completion | IN_APP / database | Synchronous in completion transaction | Failure rolls back completion/class record/earnings transaction. | No retry/dedupe. |
| Commerce: `PAYMENT_RETURNED_TO_WALLET` | Late capture/refund result to payer | IN_APP / database | Synchronous in financial transaction | Failure rolls back the surrounding refund/wallet/payment transaction under current behavior. This coupling deserves a separate financial decision; it was preserved. | No retry/dedupe. Financially sensitive metadata. |
| Teachers: `TEACHER_PRICE_REVIEWED` | Pricing moderation result to teacher | IN_APP / database | Synchronous in moderation transaction | Failure rolls back pricing status and audit log. | No retry/dedupe. |
| Teachers: `TEACHER_DOCUMENT_REVIEWED` | Verification result to teacher | IN_APP / database | Synchronous in moderation transaction | Failure rolls back verification status and audit log. | No retry/dedupe; moderation note may be sensitive. |
| Teachers: `TEACHER_AUTO_DEACTIVATED` | One-star threshold deactivation to teacher | IN_APP / database | Synchronous in review moderation transaction | Failure rolls back deactivation/audit as part of caller transaction. | No retry/dedupe. |
| Teachers: `REVIEW_MODERATED` | Review moderation result to student | IN_APP / database | Synchronous in moderation transaction | Failure rolls back review moderation/rating refresh/audit. | No retry/dedupe. |
| Tests: `TEST_ANSWER_NEEDS_REVISION` | Revision request to test taker | IN_APP / database | Synchronous in examiner transaction | Failure rolls back examiner review and answer update. | No retry/dedupe; educational result data. |
| Tests: `TEST_RESULT_READY` | Completed result and score to test taker | IN_APP / database | Synchronous in scoring/review transaction | Failure rolls back result finalization under current behavior. | No retry/dedupe; score is personal data. |

No current email, push, or external webhook/message-delivery flow was found. Seeded notifications are fixtures, not outbound flows.

## Architecture fit answers

1. A cross-cutting infrastructure dependency fits; a cross-cutting service that owns domain notification decisions does not yet fit cleanly.
2. `modules -> infrastructure/messaging` is clean and acyclic. A feature `NotificationModule` would either become a dependency of nearly every module or need callbacks into those modules.
3. Business modules should depend directly only on narrow delivery contracts. They should not send generic `{ type, recipient, data }` commands until ownership and transaction semantics are defined.
4. Event-driven dispatch is attractive for noncritical notifications, especially financial and moderation flows, but without an outbox it can lose events; with an outbox it is a major persistence/operations decision.
5. A broad module would overlap the existing Prisma models, Support read API, Queue worker, and domain-local rendering. The narrow provider boundary duplicates none of them.
6. `infrastructure/` is the documented home for external adapters. The new Kavenegar adapter belongs there.
7. Moving OTP security would break Auth ownership. Keeping `SmsService` in Auth and moving only provider HTTP preserves it.
8. OTP is an authentication concern; only delivery is messaging infrastructure.
9. Email/push could reuse delivery-result/error conventions, but recipients, templates, consent, and retry policy differ by channel. Their absence does not justify a generic dispatcher today.
10. Three real SMS templates justify a typed lookup-provider API, not a generic template registry or channel graph.
11. Provider extraction removes duplicated URL/timeout/error code. A central notification service would currently add indirection and transaction ambiguity.
12. The infrastructure direction passes existing tests. A new architecture test now prohibits concrete Kavenegar imports from feature modules.

## Options and decision matrix

| Option | Fit | Implementation / runtime complexity | Coupling | Testability | Extensibility | Operational burden | Migration risk | Security impact | Email/push readiness | Decision |
|---|---|---|---|---|---|---|---|---|---|---|
| A. Central `NotificationModule` | Medium-low | High / medium | Central service coupled to all domain message types and transaction clients | High in isolation; difficult end-to-end semantics | High superficially | Medium | High | Risk of moving OTP policy or logging generic payloads | High | Not recommended now |
| B. Narrow messaging infrastructure | **High** | Low / low | One-way features -> provider contract | **High** | Medium; new providers/channels can be added when real | Low | **Low** | **Improves secret/PII containment and normalized errors** | Medium | **Recommended** |
| C. Domain events + handlers | Medium future fit | High / high | Low domain coupling | Medium-high | High | **High** (outbox, retries, monitoring) | High | Requires secure payload/event policy | High | Not recommended without product/ops approval |
| D. Keep/harden Auth `SmsService` only | Medium | Low / low | Leaves Queue/Support duplication | Medium | Low | Low | Low | Partial improvement only | Low | Not recommended because three current consumers exist |
| E. Hybrid central notifications + synchronous Auth | Medium | High / medium | Split model and two dispatch paths | Medium | High | Medium-high | Medium-high | Preserves OTP but adds ambiguous ownership | High | Defer; possible future target after semantics are designed |

## Deferred architectural decisions

- Do not introduce events, an outbox, queues beyond the existing reminder queue, notification persistence changes, or async OTP.
- Do not centralize domain templates yet. The three Kavenegar template identifiers remain chosen by their owning callers; Persian in-app copy is unchanged.
- Separately decide whether in-app notification failure should roll back financial, moderation, scoring, support, and booking transactions. That decision is prerequisite to a notification write service or event migration.
- Define preference semantics for reminders and in-app notifications before centralizing preferences. Today only ticket-assignment SMS consults `NotificationPreference`.
- Consider typed notification kinds, delivery indexes/retention, idempotency, and a true unread query as separate data-model work.
