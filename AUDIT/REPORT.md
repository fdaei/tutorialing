# Audit report — LingoSpeak

**Date:** 2026-08-08 · **Baseline:** `ebdb499` · **Phases 0–7 complete**

---

## Executive summary

This repository had **already been audited twice**. The prior passes closed 26 findings across the
money and security paths, and that work is real — the payment lifecycle, wallet ledger and booking
concurrency are genuinely well built.

Two things made a third pass worthwhile:

1. Commit `3b04c00` **deleted the entire prior audit's evidence base** (7 documents + `npm-audit.json`)
   and `ebdb499` reused its `0X-` numbering for an unrelated schema doc set. The code fixes survived;
   the record of what was found, accepted and left open did not. Recovered from git history and used
   as input here.
2. Every prior claim predated that same `3b04c00` restructure, so all of them were **stale**. Nothing
   was inherited; everything below was re-measured.

**11 new findings. 8 fixed. 218 tests (from 193). 22 live flows, all passing.**

The most serious was a **critical** one the prior passes missed entirely.

---

## Findings

| ID | Sev | Title | Status |
|---|---|---|---|
| **FIN-102** | **CRITICAL** | Refund could exceed the captured amount under concurrency | **fixed** `ec8f3e4` |
| FIN-101 | HIGH | English locale labelled Toman as IRR — every price 10× low | **fixed** `bc19ed1` |
| SEC-201 | HIGH | 7 dependency advisories, 5 in production | open |
| SEC-202 | MEDIUM | Upload MIME is client-declared, never sniffed | open |
| SEC-205 | MEDIUM | `/bookings` mutations unthrottled | **fixed** `8f6ddfe` |
| STR-201 | MEDIUM | API had no lint config; 191 files never linted | **fixed** `6a7646a` |
| STR-202 | MEDIUM | `queue`/`bookings` deep-imported `commerce` internals | **fixed** `6a7646a` |
| DES-501/502/503 | MEDIUM | Two token systems, 163 loose hex values, no scales | open |
| DES-505 | MEDIUM | `--muted` body text failed WCAG AA (4.19:1) | **fixed** `3fbf40d` |
| AUD-001 | MEDIUM | Prior audit evidence deleted from the repo | open (process) |
| SEC-203 | LOW | JWT verify had no algorithm allowlist | **fixed** `8f6ddfe` |
| SEC-206 | LOW | `POST /auth/logout` public, DB-writing, unthrottled | **fixed** `f26e66b` |
| FIN-103 | LOW | `Reconciliation.providerAmount` isn't the provider's amount | open |
| SEC-204 | LOW | Enamad seal via `dangerouslySetInnerHTML` | accepted |

---

## The critical one

**FIN-102 — a double-click on the admin refund button refunded twice.**

The over-refund guard read `SUM(refund.amount)`, checked the request against the remainder, then
inserted a row that changed that same sum — all at the **default READ COMMITTED** isolation. Two
concurrent refunds both read the pre-insert total, both passed, both committed.

`idempotencyKey` did not save it: the key is client-supplied and the admin panel minted a fresh
`crypto.randomUUID()` **inside the submit handler**, so every click was a different key and the
replay guard never matched. This is an accident, not an attack — and the over-refund lands as
**withdrawable wallet credit**.

Notably the withdrawal path had already been fixed for this exact pattern (FIN-003, Serializable);
the refund path — fixed for a *different* issue in FIN-001 — was left at the weaker isolation.

Fixed on both sides, with a regression test **verified to fail on the pre-fix code**.

---

## What the live run proved

The API was booted against real Postgres/Redis/MinIO and walked end to end. **22 flows, 22 PASS.**

**Verify-before-grant, proven by trying to cheat it.** A genuine Zarinpal *sandbox* session was
opened, **no payment was made**, and the callback was then invoked directly with `Status=OK` —
exactly what an attacker replaying a callback URL would send:

```
payment  FAILED           gatewayReference: None
booking  PENDING_PAYMENT  (lesson NOT granted)
```

The API ignored the callback's claim, asked Zarinpal directly, was told no capture happened, and
refused. This is the single most important property of the payment system, and it is now
demonstrated rather than asserted.

Also verified live: 3 concurrent gateway redirects yielded **one** authority and two
`PAYMENT_GATEWAY_BUSY` (FIN-002 holds under real parallelism); IDOR returned **404, not 403**;
replayed `idempotencyKey` returned the same row; and rate limiting **blocked the auditor** for
several minutes with correct `RateLimit-*`/`Retry-After` headers.

---

## Three findings that were only findable by running something

Each of these had survived visual review:

- **STR-201** — `npm run lint` was green and had always been green. The API had no ESLint config, and
  `--if-present` skipped it silently. 191 files had never been linted; "all gates green" had only
  ever meant the web app.
- **SEC-206** — `authorization.spec.ts` failed on its **first run**, naming `POST /auth/logout`:
  public, writes to the DB, no rate limit. The route had been eyeballed twice.
- **STR-203** — the module-boundary rule, written as ESLint `no-restricted-imports`, **silently
  passed**. The glob provably matches the offending path under minimatch, but ESLint 9 does not
  apply it that way. A lint rule that reports nothing is worse than no rule, because green reads as
  proof. Enforcement moved to a test that was then verified to fail on the pre-fix code.

---

## Corrections made during this audit

Recorded rather than quietly edited, because an audit that hides its own errors is not worth reading.

1. **"Zero cross-module imports"** — wrong. The grep tested `../../modules/<name>/`, but siblings are
   reached as `../<name>/`. The real count is 6, two of them deep imports.
2. **Route matrix: 143 routes, 63 unscoped, admin routes unguarded** — wrong. Several files declare
   *two* `@Controller` classes; the parser read only the first, missing class-level `@Roles`. Correct:
   139 routes, 42 self-scoped, no unguarded admin route.
3. **Contrast: `--color-text-secondary` fails at ~4.4:1** — wrong token and wrong number. Computed,
   that token passes at 4.69:1; the actual failure was `--muted` at 4.19:1, which is used 218 times.
4. **MIG-001 step ordering** — my own plan had the display layer dividing by 10 *before* the data
   migration, which would have broken every price. Reordered before any code was written.

---

## What is NOT verified

- **The successful paid path.** The failure path is fully proven; granting on real payment is not —
  it needs a human at the sandbox checkout page. Refunds and payouts inherit this gap.
- **Anything in a browser.** No UI was viewed in either locale, no screenshot matrix, Playwright not
  run, browser console not observed.
- **Component state coverage** across 40+ components, keyboard navigation, responsive breakpoints.

---

## Recommended next steps

1. **Next.js major bump (SEC-201)** — highest severity, needs its own scoped project.
2. **Human-driven live verification of the paid path** — the one gap in the money evidence.
3. **Monitoring for stuck payments** — if reconciliation dies today, nobody finds out.
4. Content-sniff uploads (SEC-202); consolidate design tokens (DES-501/502/503).
5. **MIG-001 steps 2–5** — approved by the user against the audit's recommendation. Worth restating:
   this migration **fixes no defect that currently exists**. The Toman design is internally
   consistent, and the only real bug (FIN-101) was a display label already closed by step 1. Steps
   3–5 are irreversible and need a verified backup.

---

## Deliverables

`AUDIT/` — `00-baseline` · `01-financial` · `02-security` · `02-route-matrix` · `03-isolation` ·
`04-testing` · `05-design` · `06-live-verification` · `state.json` · this report.

`docs/fa/` — eight Persian documents, written for a smart reader who is not on this project, each
significant decision answering *why this and not the alternative*.

## Gates

`typecheck` / `lint` / `build` green across all three workspaces. **218 tests** (194 API, 24 web),
up from 193. Zero circular dependencies. 11 migrations applied to a live Postgres; API boots with
database and cache connected.
