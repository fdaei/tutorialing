# Role management policy

Fixes **SEC-207** (`AUDIT/security-phase-2-report.md`): `roles.manage` let a non-ADMIN actor grant
FINANCE-level and other high-impact capability it did not itself hold. This document defines the
policy now enforced by `apps/api/src/modules/admin/role-management.policy.ts` and consumed by
`admin.service.ts`.

This system has no `SUPER_ADMIN` role — `ADMIN` is the top of the hierarchy (see `Role` enum,
`schema.prisma`). "ADMIN-equivalent" below means the `ADMIN` role; introducing a separate
`SUPER_ADMIN` label would require a schema migration and touch every place that already treats
`ADMIN` as the ceiling (seed data, `assertActorIsAdminToGrantAdmin`'s prior behaviour, the web
panel-access rules), which is out of scope for closing this finding.

## The hierarchy

Three tiers, checked independently by `RoleManagementPolicy`:

| Tier | What's in it | Who can grant it |
|---|---|---|
| 1 — ADMIN | The `ADMIN` role itself | Only an existing `ADMIN` |
| 2 — Privileged | Role: `FINANCE`. Permissions: `roles.manage`, `payments.refund`, `payouts.manage`, `settings.manage` | Only an existing `ADMIN` |
| 3 — Standard | Roles: `STAFF`, `SUPPORT`, `EXAMINER`, `TEACHER`, `STUDENT`. All other permission keys (`users.read`, `teachers.verify`, `tickets.manage`, `bookings.read`, …) | Any actor holding `roles.manage` (unchanged from before this fix) |

Tier 2 is the fix. Before it, only tier 1 (the literal `ADMIN` role) was special-cased — every other
role and every permission, including the financial and security-sensitive ones, was reachable by
anyone holding the delegable `roles.manage` permission. `FINANCE` is in tier 2 as a **role** because
holding it changes which routes `AuthorizationGuard` admits (money-moving endpoints check
`roles: ADMIN,FINANCE`); `roles.manage`/`payments.refund`/`payouts.manage`/`settings.manage` are in
tier 2 as **permissions** because each independently unlocks a money- or access-control-moving
capability regardless of which role carries it.

**Rule 2 in practice:** holding `roles.manage` (tier 3's gate) never implies tier 2 access. A
`STAFF` actor with `roles.manage` can freely make someone `SUPPORT` and grant them `tickets.manage`
(tier 3), but cannot make them `FINANCE` or grant them `payments.refund`/`payouts.manage`/
`settings.manage`/`roles.manage` (tier 2) — that always requires the actor to already be `ADMIN`,
independent of whatever permissions the actor happens to hold.

## Who can do what

- **Who can create roles (the `Permission` catalogue, i.e. new permission *keys*):** nobody, via the
  API — `Permission` rows are seed-only (`prisma/seed.ts`), matching the existing, unchanged
  behaviour recorded in `AUDIT/02-schema-auth-identity.md §2.1`. This fix does not add an endpoint
  to create new permission keys.
- **Who can assign roles** (`POST /admin/roles`, `PATCH /admin/users/:id/roles`,
  `POST /admin/users` with a `roles` array): any actor holding `roles.manage`, for tier 3 roles.
  Tier 1/2 roles (`ADMIN`, `FINANCE`) require the actor to already hold `ADMIN`.
- **Who can grant permissions** (`POST /admin/permissions/grant`): any actor holding `roles.manage`,
  for tier 3 permissions, **and** the grant's target role must independently pass the role check
  above (granting `tickets.manage` under role `FINANCE` still requires ADMIN, because `FINANCE` is
  tier 2 regardless of the permission). Tier 2 permissions require the actor to already hold `ADMIN`,
  regardless of the target role.
- **Which grants require elevated (ADMIN) approval:** every tier 1 and tier 2 item above — the
  `ADMIN` role, the `FINANCE` role, and the `roles.manage`/`payments.refund`/`payouts.manage`/
  `settings.manage` permissions. Nothing else does.

## What this does not change

- Revocation (`POST /admin/roles/revoke`) is unchanged — removing privilege is not an escalation
  vector, so it keeps its existing (narrower) ADMIN-specific safeguards (self-revocation and
  last-admin-standing checks) rather than gaining the tier-2 gate.
- The self-elevation guard (`userId === actorId` → `SELF_PRIVILEGE_CHANGE`) is unchanged and still
  checked first, ahead of the tier checks, in every mutating path.
- Ordinary, non-privileged role/permission delegation for `STAFF`/`SUPPORT`/`EXAMINER`/`TEACHER` and
  operational permissions is unchanged — this fix does not require every grant to be ADMIN-approved,
  only the tier-1/2 subset.
