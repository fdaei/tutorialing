# Phase 3 — Structure & Duplication

## Baseline (Phase 6 exit criteria must not regress these)

- `madge --circular`: **0** circular deps in `apps/api/src` (173 files) and `apps/web/src` (76 files).
- `jscpd --min-lines 15`: **0** token-level clones across 127 non-test source files / 9424 lines (`apps/api/src`, `apps/web/src`, `packages/contracts/src`). Report: `AUDIT/jscpd/jscpd-report.json`.

No true copy-paste duplication was found by tooling. The findings below are about *conceptual* duplication (same intent, independently reimplemented) and dead weight, found by reading, not by the clone detector.

## STR-001 — `@lingospeak/contracts` is unusable from `apps/api` at runtime, forcing duplication (medium)

- Evidence: `packages/contracts/package.json:1` — `"type":"module"`, `"main":"src/index.ts"`, `"types":"src/index.ts"` (no build step, ships raw `.ts`, ESM). `apps/api/tsconfig.json:2` — `"module":"CommonJS"`. `apps/api/src/modules/commerce/packages.service.ts:11-14` documents the consequence directly: *"Deliberately not shared through `@lingospeak/contracts`: that package is `type: module` pointing at raw TypeScript with no build step, so the compiled CommonJS API crashes on import at runtime even though tsc and jest accept it."*
- Effect: `grep -rn "@lingospeak/contracts" apps/api/src` matches **zero real imports** — the only hit is that explanatory comment. `depcheck` independently flagged `@lingospeak/contracts` as an unused dependency of `apps/api` (`AUDIT/00-map.md` tooling section), which corroborates this rather than being a false positive.
- Concrete duplication this causes: `PACKAGE_TIERS = [1,5,10,15,20]` is defined once in `apps/api/src/modules/commerce/packages.service.ts:16` and copied verbatim in `apps/web/src/components/panel-actions.tsx:16` (comment there: *"Mirrors `PACKAGE_TIERS` in the API's packages.service.ts, which is the source"*) — a human has to remember to update both. Similarly, `packages/contracts/src/index.ts:34` exports a `TeacherCard` type that no `apps/api` module actually returns; ~13 services (`search`, `matching`, `teachers`, `admin`, `bookings`, `learning`, `commerce/payouts`, `tests`, `languages`, `reviews`, `pricing`) each independently select/shape teacher-ish fields (`nameFa`/`nameEn`/`specialties`/`rating`/`matchScore`) for their own response shapes. These aren't token-identical (jscpd correctly found no clones — they're different response contracts, not one duplicated block), so this is **not** a "must converge" refactor target on its own, but it does mean the one place a shared contract type was supposed to prevent drift (`TeacherCard`) isn't reachable from the API at all.
- This directly contradicts `CLAUDE.md`'s stated architecture: *"Cross-cutting request/response shapes should be added here [`packages/contracts`], not duplicated in each app."* The team already knows about it (the code comment), so this isn't a fresh discovery so much as a documented tech-debt item worth formally tracking.
- Minimal fix direction (not applied — structural, low risk, but touches build tooling so flagging rather than doing it inline): give `packages/contracts` a real build step (e.g. `tsc -p` emitting CJS + `.d.ts`, or dual ESM/CJS via `tsup`) so `apps/api`'s CommonJS runtime can `require()` it. Until then, new cross-cutting shapes will keep getting reinvented per-app the way `PACKAGE_TIERS` and the teacher-card shape already have.

## STR-002 — Unused dependencies (low)

- `apps/web/package.json`: `@radix-ui/react-dialog` (:18), `@radix-ui/react-slot` (:19), `class-variance-authority` (:21), `clsx` (:22), `tailwind-merge` (:28) — verified zero imports anywhere in `apps/web/src` (`grep -rl "radix-ui\|class-variance-authority\|from 'clsx'\|tailwind-merge" apps/web/src` → no hits). Likely leftover from an initial shadcn/ui scaffold.
- `apps/web/package.json:29` `zod` — zero direct imports in `apps/web/src`; the one place `apps/web` touches a Zod schema is `apps/web/src/app/matching/page.tsx:6` (`import {matchingSchema,type MatchingInput} from '@lingospeak/contracts'`), which brings its own `zod` dependency transitively. The direct `apps/web` dependency on `zod` is redundant.
- `apps/api/package.json`: `bcryptjs` — zero usages anywhere in `apps/api/src` (`grep -rn "bcryptjs\|bcrypt" apps/api/src` → no hits). Auth is phone+OTP (no passwords), so there may never have been a real use for it; it's dead weight now regardless.
- Not removing any of these per the "no drive-by changes" rule — flagging for an explicit, isolated "remove unused deps" commit if you want it.

## STR-003 — `app.module.ts` reads `process.env` directly, bypassing the `ConfigService` convention (low)

- Evidence: `apps/api/src/app.module.ts` — `JwtModule.register({global:true,secret:process.env.JWT_ACCESS_SECRET})` reads `process.env.JWT_ACCESS_SECRET` directly, while `CLAUDE.md` states *"Inject `ConfigService`; don't read `process.env` directly in services."* This is the only raw `process.env` read outside `apps/api/src/config/` (verified via `grep -rln "process\.env\." apps/api/src | grep -v config`).
- Not a security bug — `env.validation.ts` already enforces `JWT_ACCESS_SECRET` is a string ≥32 chars before the app boots, via the same `process.env` snapshot. It's a convention inconsistency: if `config()`'s zod-parsed/typed value ever diverges from raw `process.env` (e.g., a future transform), this call site won't see it.
- Minimal fix: `secret: config().JWT_ACCESS_SECRET` instead, consistent with every other config read in the codebase.

## Layering

No violations found: no controller imports `PrismaService` directly (`grep -rl "PrismaService" apps/api/src/modules/*/*.controller.ts` → no hits), consistent with the documented `controllers → services → repositories` layering in `CLAUDE.md`/`ARCHITECTURE.md`.

## Cross-app drift

Beyond STR-001's `PACKAGE_TIERS` duplication, no other drifted-logic pairs were found in this pass — most business logic (pricing tiers, discount math, booking rules) lives server-side in `apps/api`, and `apps/web` is thin enough that there wasn't much surface for drift to hide in.
