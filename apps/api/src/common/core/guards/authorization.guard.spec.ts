import { AuthorizationGuard } from './authorization.guard';

function context(role: string) {
  return {
    getHandler: () => null,
    getClass: () => null,
    switchToHttp: () => ({
      getRequest: () => ({ user: { roles: [role], permissions: [] } }),
    }),
  } as never;
}

describe('AuthorizationGuard', () => {
  const reflector = () => ({
    getAllAndOverride: jest.fn().mockReturnValueOnce(['ADMIN']).mockReturnValueOnce([]),
  });

  it('allows a matching role', () => {
    const guard = new AuthorizationGuard(reflector() as never);
    expect(guard.canActivate(context('ADMIN'))).toBe(true);
  });

  it('denies a missing role', () => {
    const guard = new AuthorizationGuard(reflector() as never);
    expect(() => guard.canActivate(context('STUDENT'))).toThrow('Role not permitted');
  });
});
