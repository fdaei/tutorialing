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

/** `userRole.findUnique` mock that reports `actorId` as holding `role`. */
function actorHolds(role: string) {
  return jest.fn().mockImplementation(({ where }: { where: { userId_role: { userId: string; role: string } } }) =>
    Promise.resolve(
      where.userId_role.userId === ACTOR && where.userId_role.role === role
        ? { userId: ACTOR, role }
        : null,
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
    await expect(svc.grantPermission(ACTOR, ACTOR, 'FINANCE', 'payments.refund')).rejects.toMatchObject({
      response: { code: 'SELF_PRIVILEGE_CHANGE' },
    });
    expect(db.rolePermission.upsert).not.toHaveBeenCalled();
  });

  it('refuses a self-targeted role addition through setUserRoles', async () => {
    const { svc } = service({
      user: { findUnique: jest.fn().mockResolvedValue({ id: ACTOR, roles: [{ role: 'STAFF' }] }) },
    });
    await expect(svc.setUserRoles(ACTOR, ACTOR, ['STAFF', 'ADMIN'])).rejects.toMatchObject({
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

/**
 * SEC-207. `roles.manage` is delegable to non-ADMIN staff, but it must never
 * be enough, by itself, to grant FINANCE-equivalent capability. See
 * ROLE_MANAGEMENT_POLICY.md for the tier-1/2/3 hierarchy these tests pin.
 */
describe('AuthorizationManagementService role-management hierarchy (SEC-207)', () => {
  it('1. STAFF cannot grant FINANCE', async () => {
    // Default service(): actor holds no ADMIN row, i.e. an ordinary STAFF
    // actor delegated `roles.manage` (the AuthorizationGuard permission
    // check on the route is what lets a STAFF actor reach this method at
    // all; the service must not also let them mint a FINANCE account).
    const { svc, db } = service();
    await expect(svc.assignRole(ACTOR, OTHER, 'FINANCE')).rejects.toMatchObject({
      response: { code: 'PRIVILEGED_ROLE_GRANT_REQUIRES_ADMIN' },
    });
    expect(db.userRole.upsert).not.toHaveBeenCalled();
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

  it('3. FINANCE cannot grant roles.manage', async () => {
    const { svc, db } = service({
      userRole: { upsert: jest.fn().mockResolvedValue({}), count: jest.fn().mockResolvedValue(2), findUnique: actorHolds('FINANCE') },
    });
    // role: 'STAFF' is not itself privileged, isolating the assertion to the
    // permission-tier check: holding FINANCE (a real, non-ADMIN privilege)
    // still must not unlock a security-sensitive permission grant.
    await expect(svc.grantPermission(ACTOR, OTHER, 'STAFF', 'roles.manage')).rejects.toMatchObject({
      response: { code: 'ELEVATED_PERMISSION_GRANT_REQUIRES_ADMIN' },
    });
    expect(db.rolePermission.upsert).not.toHaveBeenCalled();
  });

  it('4. ADMIN can perform allowed operations', async () => {
    const { svc, db } = service({
      userRole: { upsert: jest.fn().mockResolvedValue({}), count: jest.fn().mockResolvedValue(2), findUnique: actorHolds('ADMIN') },
    });
    await expect(svc.assignRole(ACTOR, OTHER, 'FINANCE')).resolves.toBeDefined();
    await expect(svc.grantPermission(ACTOR, OTHER, 'FINANCE', 'payments.refund')).resolves.toBeDefined();
    await expect(svc.grantPermission(ACTOR, OTHER, 'STAFF', 'roles.manage')).resolves.toBeDefined();
    expect(db.userRole.upsert).toHaveBeenCalled();
    expect(db.rolePermission.upsert).toHaveBeenCalled();
  });

  it('still allows a non-admin roles.manage holder to delegate a standard (tier-3) role and permission', async () => {
    // Unchanged behaviour: this is the legitimate ops-delegation use case
    // roles.manage exists for, and must not regress.
    const { svc, db } = service();
    await expect(svc.assignRole(ACTOR, OTHER, 'SUPPORT')).resolves.toBeDefined();
    await expect(svc.grantPermission(ACTOR, OTHER, 'SUPPORT', 'tickets.manage')).resolves.toBeDefined();
    expect(db.userRole.upsert).toHaveBeenCalled();
    expect(db.rolePermission.upsert).toHaveBeenCalled();
  });

  it('closes the full SEC-207 exploit chain: a STAFF actor cannot mint an accomplice into FINANCE with payments.refund', async () => {
    const { svc } = service();
    await expect(svc.assignRole(ACTOR, OTHER, 'FINANCE')).rejects.toMatchObject({
      response: { code: 'PRIVILEGED_ROLE_GRANT_REQUIRES_ADMIN' },
    });
    await expect(svc.grantPermission(ACTOR, OTHER, 'FINANCE', 'payments.refund')).rejects.toThrow();
    await expect(svc.grantPermission(ACTOR, OTHER, 'FINANCE', 'payouts.manage')).rejects.toThrow();
  });
});

/**
 * SEC-005. Roles, permissions and status are baked into the access token at
 * issuance and `AccessGuard` never re-reads them, so a privilege change that
 * doesn't publish a revocation leaves the old claims usable for up to 15 more
 * minutes on the token the user already holds.
 */
describe('AuthorizationManagementService privilege changes revoke outstanding tokens', () => {
  const adminActor = { userRole: { upsert: jest.fn().mockResolvedValue({}), count: jest.fn().mockResolvedValue(2), findUnique: jest.fn().mockResolvedValue({ userId: ACTOR, role: 'ADMIN' }), delete: jest.fn().mockResolvedValue({}), deleteMany: jest.fn().mockResolvedValue({}) } };

  it('revokes when a user is suspended', async () => {
    const { svc, revocation } = service({ user: { findUnique: jest.fn().mockResolvedValue({ id: OTHER, status: 'ACTIVE' }), update: jest.fn().mockResolvedValue({ id: OTHER, status: 'SUSPENDED' }) } });
    await svc.updateUserStatus(ACTOR, OTHER, 'SUSPENDED');
    expect(revocation.revokeUser).toHaveBeenCalledWith(OTHER);
  });

  // Reactivating cannot resurrect a token that was already voided, so there is
  // nothing to revoke and no reason to cut short a fresh session.
  it('does not revoke when a user is reactivated', async () => {
    const { svc, revocation } = service({ user: { findUnique: jest.fn().mockResolvedValue({ id: OTHER, status: 'SUSPENDED' }), update: jest.fn().mockResolvedValue({ id: OTHER, status: 'ACTIVE' }) } });
    await svc.updateUserStatus(ACTOR, OTHER, 'ACTIVE');
    expect(revocation.revokeUser).not.toHaveBeenCalled();
  });

  it('revokes when a role is assigned', async () => {
    const { svc, revocation } = service(adminActor);
    await svc.assignRole(ACTOR, OTHER, 'FINANCE');
    expect(revocation.revokeUser).toHaveBeenCalledWith(OTHER);
  });

  it('revokes when a role is taken away', async () => {
    const { svc, revocation } = service(adminActor);
    await svc.revokeRole(ACTOR, OTHER, 'FINANCE');
    expect(revocation.revokeUser).toHaveBeenCalledWith(OTHER);
  });

  it('revokes when a permission is granted', async () => {
    const { svc, revocation } = service(adminActor);
    await svc.grantPermission(ACTOR, OTHER, 'FINANCE', 'payments.refund');
    expect(revocation.revokeUser).toHaveBeenCalledWith(OTHER);
  });

  it('revokes when the whole role set is replaced', async () => {
    const { svc, revocation } = service({
      ...adminActor,
      user: { findUnique: jest.fn().mockResolvedValue({ id: OTHER, roles: [{ role: 'FINANCE' }] }), findUniqueOrThrow: jest.fn().mockResolvedValue({ id: OTHER, roles: [] }) },
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
