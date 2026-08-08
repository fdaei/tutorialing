# Phase 3 — Isolation and regression safety

Goal: one part being clean must not depend on another part staying still.

---

## 3.1 Dependency graph

### API — Nest module graph (a clean DAG)

```
admin ─────────> teachers
matching ──────> bookings ──┬──> queue
                            └──> commerce
auth ──────────> JwtModule (external)

leaves (no feature-module dependencies):
commerce, files, languages, learning, queue, search, support, teachers, tests, users
```

**Circular dependencies: 0** in both workspaces (`madge --circular`, 192 API files / 78 web files).

### Cross-module coupling — 6 edges

| From | To | Path | Kind |
|---|---|---|---|
| `matching` | `bookings` | `../bookings/bookings.module` | public interface |
| `matching` | `bookings` | `../bookings/availability.service` | top-level surface |
| `bookings` | `queue` | `../queue/queue.service` | top-level surface (`@Global`) |
| `admin` | `teachers` | `../teachers/teachers.service` | top-level surface |
| `bookings` | `commerce` | ~~`../commerce/payouts/earnings.service`~~ → `../commerce` | **was deep — fixed** |
| `queue` | `commerce` | ~~`../commerce/discounts/discount-reservation`~~ → `../commerce` | **was deep — fixed** |

> **Correction to an earlier claim.** My first sweep reported "zero cross-module imports". That was
> wrong — it grepped for `../../modules/<name>/`, but sibling modules are reached as `../<name>/`,
> which the pattern never matched. The corrected count is six, two of them deep. Recorded because
> the same mistake would make any future boundary audit read as clean when it is not.

### Shared/global state — the blast radius

| Thing | Scope | Risk |
|---|---|---|
| `CommonModule` (`@Global`) | guards, decorators, filters, Redis, settings, audit, token revocation | Every route. Highest-blast-radius code in the repo. |
| `QueueModule` (`@Global`) | `QueueService` (BullMQ) | Any module scheduling work. |
| `PrismaService` | single client, injected everywhere | All persistence. |
| Redis | rate limiting, slot locks, revocation markers, reconciliation lock | Four unrelated concerns share one server; an outage degrades all four differently (deliberately — see `AccessGuard`'s fail-open/closed split). |
| `Setting` table | commission %, escrow hold days | Changing a row silently changes money maths for all future accruals. |

---

## 3.2 Findings

### STR-201 — The API was never linted — **MEDIUM — FIXED**

`apps/api` had **no ESLint config and no `lint` script**. The root script is
`eslint --workspaces --if-present`, so all **191 API TypeScript files were silently skipped** and
every "lint green" claim in this repo's history — including the prior audit's — meant *the web app
passed*. Nothing had ever checked the API.

Fixed: `apps/api/eslint.config.mjs` plus a `lint` script. The ruleset is deliberately minimal
(TS parser, `no-undef`/`no-unused-vars` off) because enabling a recommended preset across 191
unlinted files would produce a large diff unrelated to any finding, which ground rule 3 forbids. The
point is that the config now **exists and is wired into the gate**, so future rules apply and the
root `lint` no longer over-reports.

Two stale disable-directives surfaced immediately and were removed — a `@typescript-eslint/no-require-imports`
suppression for a rule that was never enabled, and an unused `no-new` suppression. Both were dead
weight that only a linter that had actually run could have found.

### STR-202 — Two modules reached into another module's internals — **MEDIUM — FIXED**

`queue` imported `../commerce/discounts/discount-reservation` and `bookings` imported
`../commerce/payouts/earnings.service`. Both are files the `3b04c00` restructure **had already
moved** — `commerce/` was flat before that commit and was split into `discounts/ packages/
payments/ payouts/`. So this coupling had already broken once and was repaired by rewriting the
importers rather than by giving `commerce` a boundary.

Fixed with `apps/api/src/modules/commerce/index.ts`, a two-symbol public barrel
(`EarningsService`, `releaseDiscount`). Both importers now use `../commerce`. `commerce` is free to
rearrange its internals again without touching `queue` or `bookings`.

### STR-203 — Boundary rule silently passed as an ESLint rule — **INFO — worked around**

The boundary was first implemented as `no-restricted-imports` with a `patterns[].group` glob.
Verified under `minimatch` that `../{commerce,…}/*/**` **does** match
`../commerce/discounts/discount-reservation` — yet ESLint 9 reported nothing. ESLint does not apply
those globs with minimatch semantics.

This matters beyond the rule itself: **a lint rule that silently passes is worse than no rule**,
because a green run reads as proof of a property that was never checked. Enforcement was moved to
`src/architecture.spec.ts`, which is deterministic and whose failure output names the offending
edge. The reasoning is recorded in `eslint.config.mjs` so nobody re-adds the glob believing it works.

---

## 3.3 Guardrails added

`apps/api/src/architecture.spec.ts` — 4 tests, each pinning a structural property:

| Test | Pins |
|---|---|
| feature modules exist under `src/modules` | the layout the other tests assume |
| **never reaches into another module's internal folders** | STR-202 — scans every non-spec import under `src/modules`; fails naming `file -> specifier` |
| commerce public surface is exactly `{EarningsService, releaseDiscount}` | growth of the barrel is a deliberate act, not a drive-by export |
| `common/` never imports a feature module | the shared layer cannot invert into a feature dependency |

**Verified to fail on the pre-fix code.** Restoring the old deep import made the boundary test fail
with:

```
+   "modules/queue/queue.service.ts -> ../commerce/discounts/discount-reservation",
```

then pass again once reverted. This is a real guardrail, not a tautology.

---

## 3.4 Gate coverage before and after

| Gate | Before | After |
|---|---|---|
| `typecheck` | both workspaces | unchanged |
| `lint` | **web only** (API silently skipped) | **both workspaces** |
| `test` | 193 (174 API + 19 web) | **203** (179 API + 24 web) |
| circular deps | 0 (unmeasured in CI) | 0 |
| module boundaries | unenforced | enforced by `architecture.spec.ts` |

## 3.5 Summary

| Severity | Count | IDs |
|---|---|---|
| MEDIUM | 2 | STR-201 (**fixed**), STR-202 (**fixed**) |
| INFO | 1 | STR-203 (worked around, documented) |

Zero circular dependencies. Six cross-module edges, all now through public surfaces. The single
largest isolation risk that remains is not structural but operational: **Redis backs four unrelated
concerns** (rate limiting, slot locks, token revocation, the reconciliation lock), so its failure
modes are the real shared-fate surface. That is a deliberate design with documented fail-open/
fail-closed behaviour per concern, and is recorded in the Phase 7 backlog rather than changed here.
