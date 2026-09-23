# Role management policy

Fixes **SEC-207** (`AUDIT/security-phase-2-report.md`): `roles.manage` let a non-ADMIN actor grant
high-impact capability it did not itself hold. This document defines the policy enforced by
`apps/api/src/modules/auth/authorization/role-management.policy.ts`, consumed by
`authorization-management.service.ts`, and pinned by `role-management.policy.spec.ts`.

There is no `SUPER_ADMIN` role — `ADMIN` is the top of the hierarchy (`Role` enum, `schema.prisma`).

## The roles that exist

`Role` has exactly four values: `STUDENT`, `INSTRUCTOR`, `ADMIN`, `SUPPORT`.

An earlier revision of this document described `FINANCE`, `STAFF` and `EXAMINER` as roles. They were
never added to the schema. The capabilities they were meant to carry live in **permissions** instead
(`payments.refund`, `payouts.manage`, `tests.review`, `tickets.manage`, …), held by a `SUPPORT`
account. Read any older reference to a `FINANCE` role as "a `SUPPORT` account holding the finance
permissions". Keeping authority in permissions rather than minting more roles is the deliberate
choice here: a role changes what `AuthorizationGuard` admits everywhere at once, a permission does
not.

## The hierarchy

Three tiers, checked independently by `RoleManagementPolicy`:

| Tier           | What's in it                                                                                                                         | Who can grant it                 |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------- |
| 1 — ADMIN      | The `ADMIN` role itself                                                                                                              | Only an existing `ADMIN`         |
| 2 — Privileged | Roles: none today (`PRIVILEGED_ROLES` is empty). Permissions: `roles.manage`, `payments.refund`, `payouts.manage`, `settings.manage` | Only an existing `ADMIN`         |
| 3 — Standard   | Roles: `SUPPORT`, `INSTRUCTOR`, `STUDENT`. All other permission keys                                                                 | Any actor holding `roles.manage` |

Tier 2 is the fix. Before it, only the literal `ADMIN` role was special-cased — every permission,
including the financial and security-sensitive ones, was reachable by anyone holding the delegable
`roles.manage`. Each tier-2 permission independently unlocks a money- or access-control-moving
capability regardless of which role carries it.

**Rule 2 in practice:** holding `roles.manage` never implies tier 2. A `SUPPORT` actor with
`roles.manage` can grant another account `SUPPORT` and `tickets.manage` (tier 3), but cannot grant
`payments.refund`/`payouts.manage`/`settings.manage`/`roles.manage` (tier 2) — that always requires
the actor to already be `ADMIN`.

`PRIVILEGED_ROLES` being empty is a consequence of the role set, not an oversight. If a
money-moving role is ever added to the enum, it belongs in tier 2, and
`role-management.policy.spec.ts` fails until that decision is recorded.

## Who can do what

- **Creating permission keys:** nobody, via the API. `Permission` rows are seed-only
  (`prisma/seed.ts`).
- **Assigning roles** (`POST /admin/roles`, `PATCH /admin/users/:id/roles`, `POST /admin/users` with
  a `roles` array): any actor holding `roles.manage`, for tier 3. `ADMIN` requires the actor to
  already hold `ADMIN`.
- **Granting permissions** (`POST /admin/permissions/grant`): any actor holding `roles.manage`, for
  tier 3 permissions, **and** the grant's target role must independently pass the role check above.
  Tier 2 permissions require the actor to already hold `ADMIN`, regardless of the target role.

## What this does not change

- Revocation (`POST /admin/roles/revoke`) is unchanged — removing privilege is not an escalation
  vector, so it keeps its narrower ADMIN-specific safeguards (self-revocation, last-admin-standing)
  rather than gaining the tier-2 gate.
- The self-elevation guard (`userId === actorId` → `SELF_PRIVILEGE_CHANGE`) is unchanged and still
  checked first in every mutating path.

## Related: revocation fail-closed set

`AccessGuard` (`access-token.guard.ts`) must re-check the revocation marker for every staff role, or
a demoted holder keeps its old claims for the life of the token whenever Redis is unreachable.
`REVOCATION_CRITICAL_ROLES` is that set — `ADMIN` and `SUPPORT` — and `access-token.guard.spec.ts`
fails if a staff role is added to the schema without joining it. `STUDENT`/`INSTRUCTOR` fail open on
purpose, so a Redis outage degrades ordinary traffic instead of taking the API down.
