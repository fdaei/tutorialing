import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { forbidden } from '../../common';

/**
 * Roles that carry systemic or financial authority. Granting one of these to
 * anyone — including via a fresh account — requires the actor to already
 * hold ADMIN. `ADMIN` itself is handled separately (it keeps its original,
 * more specific error code); this is the tier-2 set from
 * ROLE_MANAGEMENT_POLICY.md.
 */
export const PRIVILEGED_ROLES: readonly Role[] = ['FINANCE'];

/**
 * Permissions that move money or control access itself. `roles.manage` is
 * deliberately delegable to non-ADMIN staff for ordinary role
 * administration, but holding it must never be enough, by itself, to also
 * hand out one of these — that was the SEC-207 escalation path (a STAFF
 * holder of `roles.manage` could mint a FINANCE-equivalent account without
 * ever being ADMIN or FINANCE itself).
 */
export const ELEVATED_PERMISSIONS: readonly string[] = [
  'roles.manage',
  'payments.refund',
  'payouts.manage',
  'settings.manage',
];

const adminGrantRequiresAdmin = () => forbidden('ADMIN_GRANT_REQUIRES_ADMIN');
const privilegedRoleGrantRequiresAdmin = () => forbidden('PRIVILEGED_ROLE_GRANT_REQUIRES_ADMIN');
const elevatedPermissionGrantRequiresAdmin = () => forbidden('ELEVATED_PERMISSION_GRANT_REQUIRES_ADMIN');

/**
 * Authorization policy for role/permission grants — see
 * ROLE_MANAGEMENT_POLICY.md for the full hierarchy this enforces (SEC-207).
 *
 * `roles.manage` alone only ever authorizes tier-3 (standard) grants; tier-1
 * (`ADMIN`) and tier-2 (`FINANCE`, and the elevated permissions above)
 * require the actor to already hold `ADMIN`, independent of what the actor
 * is trying to grant or what else they hold.
 */
@Injectable()
export class RoleManagementPolicy {
  constructor(private db: PrismaService) {}

  private async actorHoldsAdmin(actorId: string): Promise<boolean> {
    const grant = await this.db.userRole.findUnique({ where: { userId_role: { userId: actorId, role: 'ADMIN' } } });
    return !!grant;
  }

  /** Throws unless `actorId` may grant `role` to someone else. */
  async assertMayGrantRole(actorId: string, role: Role): Promise<void> {
    if (role === 'ADMIN') {
      if (!(await this.actorHoldsAdmin(actorId))) throw adminGrantRequiresAdmin();
      return;
    }
    if (PRIVILEGED_ROLES.includes(role) && !(await this.actorHoldsAdmin(actorId))) {
      throw privilegedRoleGrantRequiresAdmin();
    }
  }

  /** Throws unless `actorId` may grant `permissionKey` to someone else. */
  async assertMayGrantPermission(actorId: string, permissionKey: string): Promise<void> {
    if (ELEVATED_PERMISSIONS.includes(permissionKey) && !(await this.actorHoldsAdmin(actorId))) {
      throw elevatedPermissionGrantRequiresAdmin();
    }
  }
}
