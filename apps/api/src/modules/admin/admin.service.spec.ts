import { AdminService } from './admin.service';

const ACTOR = 'actor-1';
const OTHER = 'user-2';

function service(overrides: Record<string, unknown> = {}) {
  const db = {
    user: { findUnique: jest.fn().mockResolvedValue({ id: OTHER }) },
    userRole: { upsert: jest.fn().mockResolvedValue({}), count: jest.fn().mockResolvedValue(2) },
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
