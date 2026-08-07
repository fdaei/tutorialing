# Phase 1 — Financial correctness audit

**Baseline commit:** `ebdb499`. **Findings fixed in this phase:** FIN-102.
Every claim below cites a file:line I read in this pass. Prior-audit claims were **not** inherited.

---

## 1.1 The money flow, end to end

```
Teacher sets price ──> admin approves ──> Teacher.approvedTrialPrice / approvedRegularPrice
                                                    │
                                          snapshotted at booking time
                                                    ▼
                                            Booking.price
                                                    │
        POST /payments  (client sends purpose + referenceId + walletAmount + discountCode)
                                                    ▼
          subtotal = booking.price | package.price        <- server-derived, never from request
          discountAmount = max(codeDiscount, autoDiscount) <- never stacked
          amount = subtotal - discountAmount
          gatewayAmount = amount - walletAmount
                                                    │
                    gatewayAmount == 0 ?  ──yes──> status PAID, fulfil immediately
                                    │no
                                    ▼
              GET /payments/:id/gateway ──> Zarinpal request(toRial(gatewayAmount))
                                    ▼
                       user pays at Zarinpal ──> callback(authority, status)
                                    ▼
                 gateway.verify(authority, toRial(payment.gatewayAmount))   <- SERVER-SIDE amount
                                    ▼
                        result.ok ? settleVerified() : failPayment()
                                    ▼
                     status PAID + fulfil (grant entitlement)
                                    ▼
          lesson completed ──> Earning: gross = booking.price
                                        commission = round(gross * pct / 100)
                                        net = gross - commission
                                    ▼
                    WalletEntry CREDIT (net) ──> withdrawal ──> PayoutItem
```

---

## 1.2 Currency and arithmetic

### Integer money — PASS

Every money-bearing column in `schema.prisma` is `Int`. There is **no `Float` or `Decimal` on any
money field**. The 16 `Float` columns are IELTS band scores and review ratings — non-monetary.
**No float arithmetic on money anywhere.**

### Canonical unit — PASS (as built)

Canonical unit is **Toman**, documented at `gateway.service.ts:5-8`. Rial appears only at the
ZarinPal boundary via `toRial = (toman) => toman * 10` (`gateway.service.ts:8`), applied at exactly
two sites — `request()` line 25 and `verify()` line 45. **Symmetric**, so the gateway compares like
with like. No off-by-10 exists inside the API.

### Rounding — PASS

Three rounding sites, all `Math.round`, all correct:

| Site | Expression | Sums back? |
|---|---|---|
| `earnings.service.ts:41-42` | `commission = round(price*pct/100)`; `net = price - commission` | **Yes, exactly.** Net is derived by subtraction, not rounded independently. |
| `auto-discounts.service.ts:53` | `round(subtotal*value/100)`, capped by `maxAmount`, clamped to `[0, subtotal]` | Yes |
| `payments.service.ts:88` | `min(subtotal, round(subtotal*value/100))` | Yes |

**Invariant `gross == commission + net` holds by construction** — the classic "round both parts and
lose a rial" bug is absent.

---

## 1.3 Payment lifecycle

### Verify-before-grant — PASS

`payments.service.ts:190-199`. The entitlement is granted **only** after `gateway.verify()` returns
`ok`. The callback's own `status` parameter is used solely to choose fail-vs-verify (line 195); it
can never itself cause a grant. The amount passed to `verify()` is `payment.gatewayAmount` read from
the database (line 196), never from the request.

### Amount tampering — PASS

The client sends only `purpose`, `referenceId`, `walletAmount`, `discountCode`, `idempotencyKey`
(`PayDto`). Price is re-derived server-side from `booking.price` (line 69) or `pkg.price` (line 74).
`walletAmount` is bounded by both the ledger balance and the payable amount (line 106). Discounts are
looked up and validated server-side (lines 79-88). **No price, rate, or commission is ever accepted
from a request body.**

### Idempotency and replay — PASS

- `Payment.idempotencyKey` is `@unique`.
- `callback()` returns early on `PAID` (line 193) and on any non-settleable status (line 194).
- `settleVerified()` re-checks status **inside** the Serializable transaction (line 220), so a
  concurrent winner that moved the row to `PAID` *or* `REFUNDED` is respected.
- `P2034` serialization failure is retried once (lines 229-234), turning a spurious 409 into a
  correct success.

### Failure paths — PASS

`failPayment()` (line 243) credits the wallet debit back and releases the discount reservation.
`ReconciliationService` sweeps stale settleable payments every 10 minutes and repairs through the
same `settleVerified()` path a real callback uses.

### Authorization / IDOR — PASS

`payments.service.ts:61` rejects a booking whose `studentId !== userId` with a 404 (not a 403 — no
existence oracle). Package purchase requires `approvalStatus: 'APPROVED'` (line 72). Refunds require
`@Permissions('payments.refund')`.

---

## 1.4 Wallet and bookings

### Wallet — PASS (correct design)

`wallet.service.ts:8-13`. Balance is a **derived sum of an append-only ledger**:
`SUM(CREDIT) - SUM(DEBIT)` over `WalletEntry`. There is **no mutable balance column anywhere in the
schema**. `ledger()` only ever inserts (line 30). Every entry carries a unique `idempotencyKey`.

The read-then-debit pair in checkout runs at **Serializable** (`payments.service.ts:132`) and is
backed by an explicit negative-balance re-read (lines 123-128) that refuses to commit even if the
isolation level is ever weakened. This is the correct pattern.

### Double-booking — PASS

`bookings.service.ts:64` takes a Redis slot lock, then runs the overlap check and insert inside a
**Serializable** transaction (line 113). Postgres SSI detects the write skew between the predicate
read and the concurrent insert, so the guarantee is enforced at the database, not merely in
application code.

> **Note on the requested unique constraint.** Prompt 2 asks for
> `@@unique([teacherId, startsAt])`. That would be *wrong* here: a cancelled or expired booking must
> free its slot for rebooking, and a plain unique index would permanently poison the slot. The
> current lock + Serializable combination is the correct enforcement for a soft-deleted/status-based
> slot model. Recorded as a deliberate deviation, not an omission.

### Commission split — PASS

Verified by hand at `earnings.service.ts:38-54` with the default 20% rate:

| gross | commission = round(g*20/100) | net = g - commission | sums back |
|---|---|---|---|
| 500,000 | 100,000 | 400,000 | ✓ |
| 333,333 | 66,667 | 266,666 | ✓ |
| 1 | 0 | 1 | ✓ |

`Earning` is upserted on `bookingId` and the wallet credit keyed
`earning-credit:${earning.id}` — replaying a completion cannot pay a teacher twice.

---

## 1.5 Findings

### FIN-102 — Refund could exceed the captured amount — **CRITICAL — FIXED** (`ec8f3e4`)

**Location:** `apps/api/src/modules/commerce/payments/refunds.service.ts:11-27`,
`apps/web/src/components/panel-actions.tsx:449`.

**Root cause.** The over-refund guard reads `SUM(refund.amount)` for the payment (line 20), compares
the request against the remaining refundable balance (line 22), then inserts a row that changes that
same sum (line 23). The transaction ran at the **default READ COMMITTED** isolation — unlike the
withdrawal path, which FIN-003 had already moved to Serializable for this identical pattern.

**Why `idempotencyKey` did not save it.** The key is client-supplied and only matches a replay of the
*same* key. `panel-actions.tsx:449` minted a fresh `crypto.randomUUID()` **inline on every submit**,
so an ordinary double-click sent two distinct keys. The replay guard never matched. Contrast
`teacher-finance.tsx:21`, which correctly holds the key in state and rotates it only on success.

**Reproduction.** Two concurrent `POST /payments/:id/refunds` for a `PAID` payment of 500,000, each
requesting 500,000, with different idempotency keys. Both read `already = 0`, both satisfy
`500000 <= 500000 - 0`, both insert. Result: 1,000,000 refunded against a 500,000 capture.

**Impact.** Real money loss. The over-refund lands as `WalletEntry` CREDIT, which is withdrawable
cash via the payout path. Reachable by any holder of `payments.refund` (admin/finance) — and by
accident, since a double-click is sufficient.

**Fix.** Transaction moved to Serializable so Postgres SSI aborts the loser; the admin form now holds
a stable idempotency key and rotates it only once a refund is accepted.

**Regression test.** `refunds.service.spec.ts` — *"runs the over-refund check at Serializable
isolation (FIN-102)"*. **Fails on pre-fix code** (no isolation level passed at all), passes after.
Verified both ways.

### FIN-101 — English locale labels Toman as IRR — **HIGH — OPEN**

**Location:** `apps/web/src/lib/i18n.ts:37` plus 11 component sites (full list in
`AUDIT/00-baseline.md` §0.9).

Every money display does `fa ? ' تومان' : ' IRR'` on the **same integer**. Storage is Toman, so every
price shown to an English-locale user is understated **10×**. Worst case
`teacher-finance.tsx:29`: the withdrawal input is labelled `Amount (IRR)` with
`Minimum withdrawal is 100,000 IRR`, while the value posted is Toman.

Aggravating: `formatMoney` in `i18n.ts` is **dead code** (referenced only by its own spec), and the
existing test `i18n.spec.ts:14-15` asserts digit grouping only, never the currency label — so the
suite cannot see the bug.

**Deferred** pending the unit migration below, which changes the fix.

### FIN-103 — `Reconciliation.providerAmount` does not record the provider's amount — **LOW — OPEN**

`reconciliation.service.ts:155-156` writes `providerAmount: payment.gatewayAmount` — our **own**
figure, not the amount ZarinPal reported. The column's name and purpose promise an independent
cross-check, so a genuine amount mismatch between us and the gateway would be invisible in every
`Reconciliation` row. Not a live money bug (`verify()` already fails on a mismatch, since ZarinPal
validates the amount server-side), but it defeats the audit trail the table exists to provide.

---

## 1.6 Invariants that must always hold

To be asserted as tests in Phase 4.

| # | Invariant | Enforced by | Status |
|---|---|---|---|
| I1 | No money column is `Float`/`Decimal` | schema | HOLDS |
| I2 | `payment.amount == payment.subtotal - payment.discountAmount` | `payments.service.ts:104` | HOLDS |
| I3 | `payment.gatewayAmount == payment.amount - payment.walletAmount` | line 112 | HOLDS |
| I4 | `earning.grossAmount == commissionAmount + netAmount` | `earnings.service.ts:41-42` | HOLDS |
| I5 | `walletBalance(u) == SUM(CREDIT) - SUM(DEBIT)`, never negative | `wallet.service.ts:8-13` + line 123 backstop | HOLDS |
| I6 | `SUM(refund.amount per payment) <= payment.amount` | Serializable + line 22 | **HOLDS after FIN-102** |
| I7 | A `PAID` payment always has a `gatewayReference` (or `walletAmount == amount`) | `settleVerified` line 221 | HOLDS |
| I8 | At most one of `discountId` / `discountRuleId` per payment | lines 94-99 | HOLDS |
| I9 | No two `CONFIRMED`/`PENDING_PAYMENT` bookings overlap for one teacher | Redis lock + Serializable | HOLDS |
| I10 | Toman→Rial conversion is applied on both request and verify or neither | `gateway.service.ts:25,45` | HOLDS |

---

## 1.7 Approved change — migrate canonical storage from Toman to Rial

You chose Rial as canonical over my recommendation to keep Toman. This section is the plan required
by ground rule 2 (>3 modules) before any change is made. **Not yet executed.**

### Why this needs a plan, not a one-line migration

A blanket `value * 10` over every `Int` column would corrupt data. Of the 70 `Int` columns, only
**28 are money**. Three cases are actively dangerous:

| Column | Hazard |
|---|---|
| `Discount.value`, `DiscountRule.value` | **Conditional.** A percentage when `type = 'percent'`, a money amount when `type = 'fixed'` (`auto-discounts.service.ts:53`, `payments.service.ts:88`). Scaling a percent turns 20% into 200%. |
| `CreditEntry.amount` | **Not money** — a lesson-credit count. Written as `pkg.credits` (`payments.service.ts:273`) and `amount: 1` (`queue.service.ts:84`). |
| `Package.credits`, `Enrollment.creditsPurchased`, `Package.discountPercent`, `Package.lessonMinutes`, `Discount.maxUses/usedCount`, `DiscountRule.windowDays` | Counts, percentages and durations sitting adjacent to money columns in the same models. |

### Columns to scale (×10) — 28

`Teacher`: trialPrice, regularPrice, proposedTrialPrice, proposedRegularPrice, approvedTrialPrice,
approvedRegularPrice, counterTrialPrice, counterRegularPrice (8)
`TeacherPriceHistory`: the same 6 price columns (6)
`Booking`: price · `Package`: listPrice, price · `MatchingSession`: maxTrialPrice (4)
`Payment`: subtotal, discountAmount, walletAmount, gatewayAmount, amount (5)
`WalletEntry`: amount · `Refund`: amount · `Reconciliation`: providerAmount (3)
`Earning`: grossAmount, commissionAmount, netAmount (3)
`PayoutBatch`: totalAmount · `PayoutItem`: amount · `WithdrawalRequest`: amount (3)
`DiscountRule`: maxAmount (1)
`Discount.value` / `DiscountRule.value`: **only `WHERE type <> 'percent'`** (conditional)

### Columns that must NOT be scaled

All durations/minutes, `weekday`, all `order`/`rank`/`version`, `attempts`, `size`,
`remainingSeconds`, `experienceYears`, `reviewsCount`, `Review.rating`, `suitableDays`,
`Package.credits`, `Package.discountPercent`, `Enrollment.creditsPurchased`, `CreditEntry.amount`,
`Discount.maxUses`, `Discount.usedCount`, `DiscountRule.windowDays`, and every `Float`.

### Execution order

1. **Display layer first, behind the new unit.** Introduce one shared `formatMoney(rial, locale)` in
   `apps/web/src/lib/money.ts` that divides by 10 for display and labels Toman in *both* locales.
   Delete the 11 hand-rolled formatters. This alone closes FIN-101.
2. **Code constants.** `toRial()` deleted from `gateway.service.ts`; `request()`/`verify()` pass the
   stored value straight through. Audit every money literal (e.g. the 100,000 minimum withdrawal) and
   scale it.
3. **Migration**, in one transaction, with the conditional discount clause, and a verification query
   asserting I2/I3/I4 still hold across every existing row afterwards.
4. **Tests.** Update every money fixture; add a migration test asserting a percent discount is
   unchanged and a fixed discount is scaled.
5. **Rounding review.** Rial values are 10× larger, so `round(x*pct/100)` gains a digit of precision —
   strictly an improvement. But `Package.discountPercent` and any Toman-denominated *display*
   rounding must be re-checked for values that are no longer multiples of 10.

### Risk

Irreversible against production data without a verified backup, and every one of the 28 columns is
load-bearing. It is also, on the evidence above, a migration that fixes **no defect that currently
exists** — the Toman design is internally consistent and the only real bug (FIN-101) is a display
label. Recorded so the trade-off is explicit; proceeding as instructed.

---

## 1.8 Phase 1 summary

| Severity | Count | IDs |
|---|---|---|
| CRITICAL | 1 | FIN-102 (**fixed**) |
| HIGH | 1 | FIN-101 (open — folded into the unit migration) |
| LOW | 1 | FIN-103 (open) |

Ten invariants documented, all holding. Payment lifecycle, wallet ledger, commission split,
double-booking and amount-tampering defences all verified **PASS** against code read in this pass.
