# SEC-208 design note — permission-scoped search entities

Fixes **SEC-208** (`AUDIT/security-phase-2-report.md`). Reviewed before writing this:
`search.controller.ts`, `search.service.ts`, the permission-key catalogue (`prisma/seed.ts:111-135`),
the current `/admin/*` read endpoints' permission gates (`admin.controller.ts`), and
`AUDIT/02-route-matrix.md`.

## Current problem

`SearchController` (`apps/api/src/modules/search/search.controller.ts:9`) gates its single dynamic
`GET /search/:entity` route with `@Roles('ADMIN','STAFF','FINANCE','SUPPORT','EXAMINER')` only — no
`@Permissions()`. Because it's one route handling nine different entities via a runtime `:entity`
path param, NestJS's declarative `@Permissions()` decorator (evaluated per-route at request time by
the global `AuthorizationGuard`, driven by static reflected metadata) can't express "which permission
this particular request needs" — that varies per call, not per route. The result: any of the five
roles can read any of the nine entities, including `payments` (amounts, status, payer name/phone) and
`roles` (who holds what), regardless of the account's actual job function. `EXAMINER`/`SUPPORT` are
the concrete over-exposure cases already documented in the Phase 2 report.

## Entity → required permission mapping

| Entity | Required permission | Reasoning |
|---|---|---|
| `users` | `users.read` | Same permission already gates `GET /admin/users`, `GET /admin/users/:id` |
| `teachers` | `teachers.read` | Existing seed permission key (`prisma/seed.ts:114`), currently unused by any route — this is its first consumer. Distinct from `teachers.verify`, which gates the application-review workflow, not general read access |
| `tests` | `tests.manage` | Same permission already gates the `/admin/tests/*` builder endpoints this search entity supports |
| `passages` | `tests.manage` | Passages are sub-resources of tests, managed through the same `/admin/tests/*` surface |
| `bookings` | `bookings.read` | Same permission already gates `GET /admin/bookings` |
| `payments` | `payments.read` | Same permission already gates `GET /admin/payments` — the exact gap SEC-208 identified |
| `roles` | `roles.manage` | Same permission already gates `GET /admin/roles` and every role/permission-grant endpoint |
| `languages` | `languages.manage` | Same permission already gates `GET/POST/PATCH/DELETE /admin/languages` |
| `support-agents` | `tickets.manage` | This entity exists to populate the ticket-assignment picker (`PATCH /support/tickets/:id/assignment`, gated by `tickets.manage`) — same permission as the workflow it serves |

Every mapped permission already exists in the seed catalogue and already gates an equivalent
`/admin/*` (or `/support/*`) read/write endpoint — no new permission keys are introduced, keeping this
change additive rather than a parallel, second permission taxonomy.

## Authorization flow after the fix

```
RateLimitGuard → AccessGuard → AuthorizationGuard (@Roles, unchanged: must be one of the 5 staff-tier roles)
  → SearchController.search()
      → assertMaySearch(user.permissions, entity)   # NEW
          - entity not in the map           → 400 SEARCH_ENTITY_INVALID (unchanged code/status,
                                                now thrown before any query runs, not just in the
                                                service's switch default)
          - entity known, permission absent → 403 SEARCH_PERMISSION_REQUIRED (new)
          - permission present               → falls through
      → SearchService.search(entity, ...)    # unchanged, still has its own switch default as a
                                                second, redundant fail-closed layer for any future
                                                caller that reaches the service directly
```

This keeps the coarse `@Roles(...)` gate (must be staff-tier at all — a `STUDENT`/`TEACHER` account
is rejected before reaching the controller body, same as today) and adds a second, per-request,
per-entity permission check on top. Requirement 4 ("STAFF must not automatically access all
searchable entities") falls out of this directly: `@Roles` alone no longer determines what an
account can search — the account's actual granted permissions do.

`assertMaySearch` is a plain, dependency-free function (no DB/NestJS DI needed — `user.permissions`
is already on the JWT-derived `AuthUser` by the time the controller runs), so it's unit-testable in
isolation the same way `RoleManagementPolicy` was for SEC-207.

## Backward compatibility considerations

- **Response shape is unchanged.** Existing successful calls return exactly the same
  `{items, pagination}` shape; nothing about `SearchService`'s query logic changes.
- **`SEARCH_ENTITY_INVALID` for unknown entities is preserved** — same code, same 400 status, just
  raised one layer earlier (controller instead of service).
- **New error code `SEARCH_PERMISSION_REQUIRED` (403)** needs a bilingual message in
  `apps/web/src/lib/api-error-messages.ts`, matching the pattern established for SEC-207's two new
  codes.
- **Current seed data does not yet reflect least privilege.** `prisma/seed.ts:169` grants *every*
  permission key — including all nine entities' required permissions above — to the `ADMIN`,
  `STAFF`("verifier"), `SUPPORT`, `FINANCE`, and `EXAMINER` seed accounts alike. That means in the
  as-shipped seeded/demo environment, this fix's mechanism is correct but **won't visibly change
  behavior for the seed accounts** until seed data itself is tightened to grant only the permissions
  each role's job function needs — a separate, out-of-scope change (touching `prisma/seed.ts` is a
  distinct decision about the demo/dev RBAC configuration, not part of closing SEC-208's
  authorization-mechanism gap). Flagged as a remaining risk in the completion report below. The
  regression tests for this fix construct explicit, minimal `AuthUser.permissions` fixtures per
  scenario rather than relying on seed data, so they verify the mechanism independent of that
  separate seed-hygiene issue.
- **`ADMIN` gets no special-case bypass** — consistent with how `RoleManagementPolicy` (SEC-207) and
  `AuthorizationGuard` already work in this codebase: `ADMIN` passes because `grantAdminPermissions()`
  ensures an `ADMIN` account holds every permission key, not because the code path special-cases the
  `ADMIN` role. "Keep ADMIN behavior unchanged" is satisfied by this falling out of the existing
  permission-granting mechanism, not by adding a bypass.
- **No route signature change** — still `GET /search/:entity`; `@Param('entity')` narrows from
  `SearchEntity` to `string` at the controller boundary (it was already just a string at runtime;
  the old type annotation asserted a narrower type with no runtime check behind it) and gets
  type-narrowed back to `SearchEntity` by `assertMaySearch`'s type guard before being passed to the
  service — closes a latent gap where the compile-time type was never actually validated at runtime
  before reaching the switch.
