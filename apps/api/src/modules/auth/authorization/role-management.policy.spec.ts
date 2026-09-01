import { ELEVATED_PERMISSIONS, PRIVILEGED_ROLES, RoleManagementPolicy } from './role-management.policy';

const ACTOR = 'actor-1';

function policy(actorRoles: string[] = []) {
  const findUnique = jest
    .fn()
    .mockImplementation(({ where }: { where: { userId_role: { userId: string; role: string } } }) =>
      Promise.resolve(
        where.userId_role.userId === ACTOR && actorRoles.includes(where.userId_role.role)
          ? { userId: ACTOR, role: where.userId_role.role }
          : null,
      ),
    );
  const db = { userRole: { findUnique } };
  return { p: new RoleManagementPolicy(db as never), findUnique };
}

describe('RoleManagementPolicy hierarchy constants', () => {
  it('keeps authority in permissions instead of creating another privileged role', () => {
    expect(PRIVILEGED_ROLES).toEqual([]);
  });

  it('lists exactly the financial and security-sensitive permissions as elevated', () => {
    expect([...ELEVATED_PERMISSIONS].sort()).toEqual(
      ['roles.manage', 'payments.refund', 'payouts.manage', 'settings.manage'].sort(),
    );
  });
});

describe('RoleManagementPolicy.assertMayGrantRole', () => {
  it('rejects granting ADMIN when the actor is not ADMIN', async () => {
    const { p } = policy([]);
    await expect(p.assertMayGrantRole(ACTOR, 'ADMIN')).rejects.toMatchObject({
      response: { code: 'ADMIN_GRANT_REQUIRES_ADMIN' },
    });
  });

  it('allows an ADMIN to grant every canonical role', async () => {
    const { p } = policy(['ADMIN']);
    await expect(p.assertMayGrantRole(ACTOR, 'ADMIN')).resolves.toBeUndefined();
    await expect(p.assertMayGrantRole(ACTOR, 'SUPPORT')).resolves.toBeUndefined();
  });

  it.each(['SUPPORT', 'INSTRUCTOR', 'STUDENT'])(
    'allows granting the standard role %s without the actor holding ADMIN',
    async (role) => {
      const { p, findUnique } = policy([]);
      await expect(p.assertMayGrantRole(ACTOR, role as never)).resolves.toBeUndefined();
      // No DB lookup needed at all for a role that was never in contention.
      expect(findUnique).not.toHaveBeenCalled();
    },
  );
});

describe('RoleManagementPolicy.assertMayGrantPermission', () => {
  it.each(ELEVATED_PERMISSIONS)('rejects granting %s when the actor is not ADMIN', async (permission) => {
    const { p } = policy(['SUPPORT']);
    await expect(p.assertMayGrantPermission(ACTOR, permission)).rejects.toMatchObject({
      response: { code: 'ELEVATED_PERMISSION_GRANT_REQUIRES_ADMIN' },
    });
  });

  it.each(ELEVATED_PERMISSIONS)('allows granting %s when the actor is ADMIN', async (permission) => {
    const { p } = policy(['ADMIN']);
    await expect(p.assertMayGrantPermission(ACTOR, permission)).resolves.toBeUndefined();
  });

  it('allows granting a standard (non-elevated) permission without the actor holding ADMIN', async () => {
    const { p, findUnique } = policy([]);
    await expect(p.assertMayGrantPermission(ACTOR, 'tickets.manage')).resolves.toBeUndefined();
    expect(findUnique).not.toHaveBeenCalled();
  });
});
