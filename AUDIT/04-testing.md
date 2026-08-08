# Phase 4 — Tests

**218 tests** (194 API across 33 suites, 24 web across 7). Baseline was 193.
Risk coverage, not a coverage percentage.

---

## 4.1 What was added, and what each one buys

| Suite | Tests | Pins |
|---|---|---|
| `src/architecture.spec.ts` | 4 | Module boundaries (STR-202) — verified to fail on pre-fix code |
| `src/authorization.spec.ts` | 5 | Route × role matrix — **found a real gap on first run** |
| `modules/commerce/money-invariants.spec.ts` | 10 | Financial invariants I1–I4 |
| `payments/refunds.service.spec.ts` (+1) | 1 | FIN-102 — verified to fail on pre-fix code |
| `web/lib/money.spec.ts` | 5 | FIN-101 currency label |

### The authorization matrix earned its place immediately

On its first run it failed, reporting:

```
POST /auth/logout  (modules/auth/auth.controller.ts)
```

`POST /auth/logout` is `@Public()` (it has to work with an expired access token), writes to the
database on every call, and had **no rate limit** — a free unauthenticated DB-load vector. Fixed
with its own `auth:logout` bucket, deliberately separate so logout spam cannot consume a legitimate
client's refresh budget. Filed as **SEC-206 (LOW, fixed)**.

That is the whole argument for table-driven authorization tests: the route had been reviewed twice
by eye and read as fine both times.

### The matrix forces a decision on every route

Every route must fall into exactly one bucket — `@Public()`, role/permission-gated, or on the
explicit `SELF_SCOPED` allowlist (42 routes, each read and confirmed in `02-security.md` §2.2). A
new route that is none of these **fails the build**. "I forgot the guard" cannot ship silently.

It also pins two invariants that are easy to erode: the public surface cannot grow past 16 routes
without a deliberate edit, and no public write route may be unthrottled.

### Money invariants are stated, not re-run

`money-invariants.spec.ts` **re-implements** the formulas rather than importing the services. A test
that imports the implementation and re-runs it proves only that the code equals itself. These encode
the rule the audit verified by hand, over a grid of 8 amounts × 10 percentages including primes and
values that do not divide evenly:

- **I4** — `commission + net == gross` **exactly**, for all 80 combinations. This is the one that
  matters: net is derived by subtraction, never rounded independently. Rounding both halves is how a
  platform silently mints or loses money.
- **I1** — every derived figure stays integral across the whole grid.
- **Discount semantics** — pins the MIG-001 hazard: `value` is a percentage when `type='percent'`
  and an amount otherwise, so any money migration must be conditional per row.

---

## 4.2 What is deliberately not tested, and why

| Area | Why not |
|---|---|
| **True DB concurrency** | Postgres SSI cannot be exercised with a mocked Prisma client. The guarantee is instead pinned by asserting the **isolation level** passed to `$transaction` (FIN-102, FIN-003). Real concurrency needs the load scripts in `load/` against a live database — Phase 6. |
| **Live gateway** | No `ZARINPAL_MERCHANT_ID` in this environment. `gateway.service.ts` is unit-tested against a mock; the reconciliation repair path has never made a real `verify` round-trip. Carried from the prior audit as a known gap. |
| **E2E (Playwright)** | 2 specs exist; not run in this pass — needs the full stack up. Phase 6. |
| **i18n/RTL rendering** | No visual/DOM assertions on direction or Persian numerals beyond `money.spec.ts`. Phase 5 backlog. |
| **Iranian validators** | No national-ID or mobile validator exists in the codebase to test; phone validation is a DTO-level regex. |

---

## 4.3 How to run

```bash
npm run test                       # everything, both workspaces
npm run test -w @lingospeak/api    # API only (jest --runInBand, rootDir=src)
npm run test -w @lingospeak/web    # web only (ts-jest, jsdom)
npm run test -w @lingospeak/api -- money-invariants.spec.ts   # one file
npm run test -w @lingospeak/api -- -t "commission"            # by name
npm run verify                     # db:format + db:validate + typecheck + lint + test + build
```

`npm run lint` now covers **both** workspaces. Until Phase 3 it silently skipped the API entirely
(STR-201), so any historical "all gates green" claim about API code was unsupported.

---

## 4.4 How to add a test

1. **Fixing a bug?** Write the test first and *run it against the unfixed code*. If it passes, it is
   not testing the bug. Both FIN-102 and STR-202 were verified to fail before their fix and pass
   after — state this in a comment with the finding ID, as those do.
2. **New route?** It must be `@Public()`, guarded, or added to `SELF_SCOPED` in
   `authorization.spec.ts` — and only add it there after confirming the service filters by the
   caller's own id.
3. **Touching money?** Add the law to `money-invariants.spec.ts` as a property over the existing
   grid, not a single worked example.
4. **Crossing a module boundary?** `architecture.spec.ts` will stop you. Export through the module's
   barrel instead of deep-importing.

## 4.5 Summary

| | Baseline | Now |
|---|---|---|
| API tests | 174 | **194** |
| Web tests | 19 | **24** |
| Total | 193 | **218** |
| Suites | 36 | 40 |
| Regression tests proven to fail pre-fix | 0 | 2 (FIN-102, STR-202) |
| Structural guardrails | 0 | 9 (4 boundary + 5 authorization) |
