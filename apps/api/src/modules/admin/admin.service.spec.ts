import { AdminService } from './admin.service';

const ACTOR = 'actor-1';
const OTHER = 'user-2';

function service(overrides: Record<string, unknown> = {}) {
  const db = {
    user: { findUnique: jest.fn().mockResolvedValue({ id: OTHER }), create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 'new-user', ...data })) },
    userRole: { upsert: jest.fn().mockResolvedValue({}), count: jest.fn().mockResolvedValue(2), findUnique: jest.fn().mockResolvedValue(null) },
    permission: { findUnique: jest.fn().mockResolvedValue({ id: 'perm-1', key: 'payments.refund' }), findMany: jest.fn().mockResolvedValue([]) },
    rolePermission: { upsert: jest.fn().mockResolvedValue({}), createMany: jest.fn().mockResolvedValue({}) },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    ...overrides,
  };
  return { svc: new AdminService(db as never, {} as never), db };
}

describe('AdminService privilege self-escalation', () => {
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
    await expect(svc.setUserRoles(ACTOR, ACTOR, ['STUDENT'])).rejects.toThrow(/own admin role/);
  });
});

describe('AdminService admin-grant requires an existing admin (SEC-001/SEC-003)', () => {
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
    const { svc, db } = service({ userRole: { upsert: jest.fn().mockResolvedValue({}), count: jest.fn().mockResolvedValue(2), findUnique: jest.fn().mockResolvedValue({ userId: ACTOR, role: 'ADMIN' }) } });
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
    const { svc, db } = service({ userRole: { upsert: jest.fn().mockResolvedValue({}), count: jest.fn().mockResolvedValue(2), findUnique: jest.fn().mockResolvedValue({ userId: ACTOR, role: 'ADMIN' }) } });
    await expect(svc.assignRole(ACTOR, OTHER, 'ADMIN')).resolves.toBeDefined();
    expect(db.userRole.upsert).toHaveBeenCalled();
  });
});
