import { AuthorizationManagementService } from './authorization-management.service';
import { AdminUsersService } from '../../users/admin-users.service';
import { RoleManagementPolicy } from './role-management.policy';

const ACTOR = 'actor-1';
const OTHER = 'user-2';

function service(overrides: Record<string, unknown> = {}) {
  const db = {
    user: {
      findUnique: jest.fn().mockResolvedValue({ id: OTHER }),
      create: jest
        .fn()
        .mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ id: 'new-user', ...data }),
        ),
    },
    userRole: {
      upsert: jest.fn().mockResolvedValue({}),
      count: jest.fn().mockResolvedValue(2),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    permission: {
      findUnique: jest.fn().mockResolvedValue({ id: 'perm-1', key: 'payments.refund' }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    rolePermission: { upsert: jest.fn().mockResolvedValue({}), createMany: jest.fn().mockResolvedValue({}) },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    ...overrides,
  };
  const revocation = { revokeUser: jest.fn().mockResolvedValue(undefined) };
  const policy = new RoleManagementPolicy(db as never);
  const authorization = new AuthorizationManagementService(db as never, revocation as never, policy);
  const users = new AdminUsersService(db as never, authorization, revocation as never);
  return {
    svc: {
      assignRole: authorization.assignRole.bind(authorization),
      grantPermission: authorization.grantPermission.bind(authorization),
      setUserRoles: authorization.setUserRoles.bind(authorization),
      revokeRole: authorization.revokeRole.bind(authorization),
      createUser: users.create.bind(users),
      updateUserStatus: users.updateStatus.bind(users),
    },
    db,
    revocation,
  };
}

function actorHolds(role: string) {
  return jest
    .fn()
    .mockImplementation(({ where }: { where: { userId_role: { userId: string; role: string } } }) =>
      Promise.resolve(
        where.userId_role.userId === ACTOR && where.userId_role.role === role ? { userId: ACTOR, role } : null,
      ),
    );
}

describe('AuthorizationManagementService privilege self-escalation', () => {
  // `roles.manage` is delegable, so its holder is not necessarily an ADMIN.
  // Every path that can raise privileges must refuse to target the caller.
  it('refuses to assign the actor a role', async () => {
    const { svc, db } = service();
    await expect(svc.assignRole(ACTOR, ACTOR, 'ADMIN')).rejects.toMatchObject({
      response: { code: 'SELF_PRIVILEGE_CHANGE' },
    });
    expect(db.userRole.upsert).not.toHaveBeenCalled();
  });

  it('refuses to grant the actor a permission', async () => {
    const { svc, db } = service();
    await expect(svc.grantPermission(ACTOR, ACTOR, 'SUPPORT', 'payments.refund')).rejects.toMatchObject({
      response: { code: 'SELF_PRIVILEGE_CHANGE' },
    });
    expect(db.rolePermission.upsert).not.toHaveBeenCalled();
  });

  it('refuses a self-targeted role addition through setUserRoles', async () => {
    const { svc } = service({
      user: { findUnique: jest.fn().mockResolvedValue({ id: ACTOR, roles: [{ role: 'SUPPORT' }] }) },
    });
    await expect(svc.setUserRoles(ACTOR, ACTOR, ['SUPPORT', 'ADMIN'])).rejects.toMatchObject({
      response: { code: 'SELF_PRIVILEGE_CHANGE' },
    });
  });

  it('still allows changing another user', async () => {
    const { svc, db } = service();
    await expect(svc.assignRole(ACTOR, OTHER, 'SUPPORT')).resolves.toBeDefined();
    expect(db.userRole.upsert).toHaveBeenCalled();
  });

  it('still blocks removing your own last admin role', async () => {
    const { svc } = service({
      user: { findUnique: jest.fn().mockResolvedValue({ id: ACTOR, roles: [{ role: 'ADMIN' }] }) },
    });
    await expect(svc.setUserRoles(ACTOR, ACTOR, ['STUDENT'])).rejects.toMatchObject({
      response: { code: 'SELF_ADMIN_ROLE_REMOVE' },
    });
  });
});

describe('AuthorizationManagementService admin-grant requires an existing admin (SEC-001/SEC-003)', () => {
  // A STAFF holder of the delegable `roles.manage`/`permissions.manage`
  // permission is not necessarily an ADMIN. None of these targets the
  // actor's own row, so the userId===actorId self-elevation guard alone
  // never fires for them -- the actor must now already hold ADMIN.
  it('blocks a non-admin actor from creating a brand-new ADMIN account', async () => {
    const { svc, db } = service();
    await expect(svc.createUser(ACTOR, { phone: '09120000099', name: 'x', roles: ['ADMIN'] })).rejects.toMatchObject({
      response: { code: 'ADMIN_GRANT_REQUIRES_ADMIN' },
    });
    expect(db.user.create).not.toHaveBeenCalled();
  });

  it('allows an existing admin actor to create a new ADMIN account', async () => {
    const { svc, db } = service({
      userRole: {
        upsert: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(2),
        findUnique: jest.fn().mockResolvedValue({ userId: ACTOR, role: 'ADMIN' }),
      },
    });
    await expect(svc.createUser(ACTOR, { phone: '09120000099', name: 'x', roles: ['ADMIN'] })).resolves.toBeDefined();
    expect(db.user.create).toHaveBeenCalled();
  });

  it('blocks a non-admin actor from assigning ADMIN to a different user', async () => {
    const { svc, db } = service();
    await expect(svc.assignRole(ACTOR, OTHER, 'ADMIN')).rejects.toMatchObject({
      response: { code: 'ADMIN_GRANT_REQUIRES_ADMIN' },
    });
    expect(db.userRole.upsert).not.toHaveBeenCalled();
  });

  it('blocks the proxy-account escalation: a non-admin actor cannot grantPermission under role ADMIN for a second account', async () => {
    const { svc, db } = service();
    await expect(svc.grantPermission(ACTOR, OTHER, 'ADMIN', 'roles.manage')).rejects.toMatchObject({
      response: { code: 'ADMIN_GRANT_REQUIRES_ADMIN' },
    });
    expect(db.rolePermission.upsert).not.toHaveBeenCalled();
  });

  it('blocks a non-admin actor from adding ADMIN to another user via setUserRoles', async () => {
    const { svc } = service({
      user: { findUnique: jest.fn().mockResolvedValue({ id: OTHER, roles: [{ role: 'STUDENT' }] }) },
    });
    await expect(svc.setUserRoles(ACTOR, OTHER, ['STUDENT', 'ADMIN'])).rejects.toMatchObject({
      response: { code: 'ADMIN_GRANT_REQUIRES_ADMIN' },
    });
  });

  it('allows an existing admin actor to grant ADMIN to another user', async () => {
    const { svc, db } = service({
      userRole: {
        upsert: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(2),
        findUnique: jest.fn().mockResolvedValue({ userId: ACTOR, role: 'ADMIN' }),
      },
    });
    await expect(svc.assignRole(ACTOR, OTHER, 'ADMIN')).resolves.toBeDefined();
    expect(db.userRole.upsert).toHaveBeenCalled();
  });
});

describe('AuthorizationManagementService role-management hierarchy (SEC-207)', () => {
  it('treats SUPPORT as a standard role without inheriting financial authority', async () => {
    const { svc, db } = service();
    await expect(svc.assignRole(ACTOR, OTHER, 'SUPPORT')).resolves.toBeDefined();
    expect(db.userRole.upsert).toHaveBeenCalled();
  });

  it('2. SUPPORT cannot grant PAYMENTS permissions', async () => {
    const { svc, db } = service();
    // role: 'SUPPORT' is not itself privileged, isolating the assertion to
    // the permission-tier check rather than the role-tier check.
    await expect(svc.grantPermission(ACTOR, OTHER, 'SUPPORT', 'payments.refund')).rejects.toMatchObject({
      response: { code: 'ELEVATED_PERMISSION_GRANT_REQUIRES_ADMIN' },
    });
    expect(db.rolePermission.upsert).not.toHaveBeenCalled();
  });

  it('does not let a SUPPORT actor grant roles.manage', async () => {
    const { svc, db } = service({
      userRole: {
        upsert: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(2),
        findUnique: actorHolds('SUPPORT'),
      },
    });
    await expect(svc.grantPermission(ACTOR, OTHER, 'SUPPORT', 'roles.manage')).rejects.toMatchObject({
      response: { code: 'ELEVATED_PERMISSION_GRANT_REQUIRES_ADMIN' },
    });
    expect(db.rolePermission.upsert).not.toHaveBeenCalled();
  });

  it('lets ADMIN perform elevated operations', async () => {
    const { svc, db } = service({
      userRole: {
        upsert: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(2),
        findUnique: actorHolds('ADMIN'),
      },
    });
    await expect(svc.assignRole(ACTOR, OTHER, 'SUPPORT')).resolves.toBeDefined();
    await expect(svc.grantPermission(ACTOR, OTHER, 'SUPPORT', 'payments.refund')).resolves.toBeDefined();
    await expect(svc.grantPermission(ACTOR, OTHER, 'ADMIN', 'roles.manage')).resolves.toBeDefined();
    expect(db.userRole.upsert).toHaveBeenCalled();
    expect(db.rolePermission.upsert).toHaveBeenCalled();
  });

  it('allows assigning a standard permission without manufacturing an elevated capability', async () => {
    const { svc, db } = service();
    await expect(svc.assignRole(ACTOR, OTHER, 'SUPPORT')).resolves.toBeDefined();
    await expect(svc.grantPermission(ACTOR, OTHER, 'SUPPORT', 'tickets.manage')).resolves.toBeDefined();
    expect(db.userRole.upsert).toHaveBeenCalled();
    expect(db.rolePermission.upsert).toHaveBeenCalled();
  });

  it('closes the privilege chain even after a standard SUPPORT role is assigned', async () => {
    const { svc } = service();
    await expect(svc.assignRole(ACTOR, OTHER, 'SUPPORT')).resolves.toBeDefined();
    await expect(svc.grantPermission(ACTOR, OTHER, 'SUPPORT', 'payments.refund')).rejects.toThrow();
    await expect(svc.grantPermission(ACTOR, OTHER, 'SUPPORT', 'payouts.manage')).rejects.toThrow();
  });
});

/**
 * SEC-005. Roles, permissions and status are baked into the access token at
 * issuance and `AccessGuard` never re-reads them, so a privilege change that
 * doesn't publish a revocation leaves the old claims usable for up to 15 more
 * minutes on the token the user already holds.
 */
describe('AuthorizationManagementService privilege changes revoke outstanding tokens', () => {
  const adminActor = {
    userRole: {
      upsert: jest.fn().mockResolvedValue({}),
      count: jest.fn().mockResolvedValue(2),
      findUnique: jest.fn().mockResolvedValue({ userId: ACTOR, role: 'ADMIN' }),
      delete: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({}),
    },
  };

  it('revokes when a user is suspended', async () => {
    const { svc, revocation } = service({
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: OTHER, status: 'ACTIVE' }),
        update: jest.fn().mockResolvedValue({ id: OTHER, status: 'SUSPENDED' }),
      },
    });
    await svc.updateUserStatus(ACTOR, OTHER, 'SUSPENDED');
    expect(revocation.revokeUser).toHaveBeenCalledWith(OTHER);
  });

  // Reactivating cannot resurrect a token that was already voided, so there is
  // nothing to revoke and no reason to cut short a fresh session.
  it('does not revoke when a user is reactivated', async () => {
    const { svc, revocation } = service({
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: OTHER, status: 'SUSPENDED' }),
        update: jest.fn().mockResolvedValue({ id: OTHER, status: 'ACTIVE' }),
      },
    });
    await svc.updateUserStatus(ACTOR, OTHER, 'ACTIVE');
    expect(revocation.revokeUser).not.toHaveBeenCalled();
  });

  it('revokes when a role is assigned', async () => {
    const { svc, revocation } = service(adminActor);
    await svc.assignRole(ACTOR, OTHER, 'SUPPORT');
    expect(revocation.revokeUser).toHaveBeenCalledWith(OTHER);
  });

  it('revokes when a role is taken away', async () => {
    const { svc, revocation } = service(adminActor);
    await svc.revokeRole(ACTOR, OTHER, 'SUPPORT');
    expect(revocation.revokeUser).toHaveBeenCalledWith(OTHER);
  });

  it('revokes when a permission is granted', async () => {
    const { svc, revocation } = service(adminActor);
    await svc.grantPermission(ACTOR, OTHER, 'SUPPORT', 'payments.refund');
    expect(revocation.revokeUser).toHaveBeenCalledWith(OTHER);
  });

  it('revokes when the whole role set is replaced', async () => {
    const { svc, revocation } = service({
      ...adminActor,
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: OTHER, roles: [{ role: 'SUPPORT' }] }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: OTHER, roles: [] }),
      },
      $transaction: jest.fn().mockImplementation((fn: (t: unknown) => unknown) =>
        fn({
          userRole: adminActor.userRole,
          auditLog: { create: jest.fn() },
          refreshSession: { updateMany: jest.fn() },
        }),
      ),
    });
    await svc.setUserRoles(ACTOR, OTHER, ['STUDENT']);
    expect(revocation.revokeUser).toHaveBeenCalledWith(OTHER);
  });
});
