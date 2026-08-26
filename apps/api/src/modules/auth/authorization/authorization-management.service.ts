import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { forbidden } from '../../../common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { TokenRevocationService } from '../token-revocation.service';
import { RoleManagementPolicy } from './role-management.policy';

const selfElevation = () => forbidden('SELF_PRIVILEGE_CHANGE');

@Injectable()
export class AuthorizationManagementService {
  constructor(
    private readonly db: PrismaService,
    private readonly revocation: TokenRevocationService,
    private readonly policy: RoleManagementPolicy,
  ) {}

  assertMayGrantRole(actorId: string, role: Role) { return this.policy.assertMayGrantRole(actorId, role); }

  roles() {
    return this.db.userRole.findMany({
      include: { user: { select: { phone: true, name: true } }, permissions: { include: { permission: true } } },
      orderBy: { userId: 'asc' }, take: 300,
    });
  }

  permissions() { return this.db.permission.findMany({ orderBy: { key: 'asc' } }); }

  async setUserRoles(actorId: string, userId: string, roles: Role[]) {
    const normalized = [...new Set(roles)];
    if (!normalized.length) throw new BadRequestException({ code: 'ROLE_REQUIRED' });
    const user = await this.db.user.findUnique({ where: { id: userId }, include: { roles: true } });
    if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND' });
    const before = user.roles.map((item) => item.role);
    if (userId === actorId && before.includes('ADMIN') && !normalized.includes('ADMIN'))
      throw new BadRequestException({ code: 'SELF_ADMIN_ROLE_REMOVE' });
    if (userId === actorId && normalized.some((role) => !before.includes(role))) throw selfElevation();
    for (const role of normalized.filter((role) => !before.includes(role))) await this.policy.assertMayGrantRole(actorId, role);
    if (before.includes('ADMIN') && !normalized.includes('ADMIN')) {
      if ((await this.db.userRole.count({ where: { role: 'ADMIN' } })) <= 1)
        throw new BadRequestException({ code: 'LAST_ADMIN_ROLE_REMOVE' });
    }
    await this.db.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId, role: { notIn: normalized } } });
      for (const role of normalized)
        await tx.userRole.upsert({ where: { userId_role: { userId, role } }, create: { userId, role }, update: {} });
      await tx.auditLog.create({ data: { actorId, action: 'user.roles.changed', entity: 'User', entityId: userId, before: { roles: before }, after: { roles: normalized } } });
      await tx.refreshSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    });
    if (normalized.includes('ADMIN')) await this.grantAdminPermissions(userId);
    await this.revocation.revokeUser(userId);
    return this.db.user.findUniqueOrThrow({ where: { id: userId }, include: { roles: true } });
  }

  async assignRole(actorId: string, userId: string, role: Role) {
    if (userId === actorId) throw selfElevation();
    await this.policy.assertMayGrantRole(actorId, role);
    if (!(await this.db.user.findUnique({ where: { id: userId } }))) throw new NotFoundException({ code: 'USER_NOT_FOUND' });
    const out = await this.db.userRole.upsert({ where: { userId_role: { userId, role } }, create: { userId, role }, update: {} });
    if (role === 'ADMIN') await this.grantAdminPermissions(userId);
    await this.revocation.revokeUser(userId);
    await this.db.auditLog.create({ data: { actorId, action: 'role.assigned', entity: 'UserRole', entityId: userId, after: { role } } });
    return out;
  }

  async grantAdminPermissions(userId: string) {
    const permissions = await this.db.permission.findMany({ select: { id: true } });
    if (permissions.length) await this.db.rolePermission.createMany({
      data: permissions.map((permission) => ({ userId, role: 'ADMIN' as const, permissionId: permission.id })), skipDuplicates: true,
    });
  }

  async revokeRole(actorId: string, userId: string, role: Role) {
    if (role === 'ADMIN') {
      if (userId === actorId) throw new BadRequestException({ code: 'SELF_ADMIN_ROLE_REMOVE' });
      if ((await this.db.userRole.count({ where: { role: 'ADMIN' } })) <= 1)
        throw new BadRequestException({ code: 'LAST_ADMIN_ROLE_REMOVE' });
    }
    await this.db.userRole.delete({ where: { userId_role: { userId, role } } });
    await this.revocation.revokeUser(userId);
    await this.db.auditLog.create({ data: { actorId, action: 'role.revoked', entity: 'UserRole', entityId: userId, before: { role } } });
    return { ok: true };
  }

  async grantPermission(actorId: string, userId: string, role: Role, permissionKey: string) {
    if (userId === actorId) throw selfElevation();
    await this.policy.assertMayGrantRole(actorId, role);
    await this.policy.assertMayGrantPermission(actorId, permissionKey);
    const permission = await this.db.permission.findUnique({ where: { key: permissionKey } });
    if (!permission) throw new NotFoundException({ code: 'PERMISSION_NOT_FOUND' });
    await this.db.userRole.upsert({ where: { userId_role: { userId, role } }, create: { userId, role }, update: {} });
    const out = await this.db.rolePermission.upsert({
      where: { userId_role_permissionId: { userId, role, permissionId: permission.id } },
      create: { userId, role, permissionId: permission.id }, update: {},
    });
    await this.revocation.revokeUser(userId);
    await this.db.auditLog.create({ data: { actorId, action: 'permission.granted', entity: 'RolePermission', entityId: userId, after: { role, permission: permissionKey } } });
    return out;
  }
}
