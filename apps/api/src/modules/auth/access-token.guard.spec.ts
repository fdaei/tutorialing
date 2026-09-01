import { Logger } from '@nestjs/common';
import { AccessGuard } from './access-token.guard';

// The store-unreachable cases below log deliberately; without this the expected
// stack traces drown out real failures in the test output.
beforeAll(() => jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined));
afterAll(() => jest.restoreAllMocks());

const NOW = 1_800_000_000;

function context(isPublic = false) {
  const req: Record<string, unknown> = { headers: { authorization: 'Bearer token' } };
  return {
    req,
    ctx: {
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => req }),
    } as never,
    reflector: { getAllAndOverride: jest.fn().mockReturnValue(isPublic) },
  };
}

function guard(payload: Record<string, unknown>, revokedAt: number | Error = 0) {
  const jwt = { verifyAsync: jest.fn().mockResolvedValue(payload) };
  const revocation = {
    revokedAt: jest
      .fn()
      .mockImplementation(() => (revokedAt instanceof Error ? Promise.reject(revokedAt) : Promise.resolve(revokedAt))),
  };
  return {
    jwt,
    revocation,
    build: (reflector: unknown) => new AccessGuard(reflector as never, jwt as never, revocation as never),
  };
}

const student = { id: 'user-1', roles: ['STUDENT'], permissions: [], sessionId: 's1', iat: NOW };
const admin = { ...student, roles: ['ADMIN'] };

describe('AccessGuard revocation (SEC-005)', () => {
  it('admits a token issued after the last revocation', async () => {
    const c = context();
    const g = guard(admin, NOW - 10);
    await expect(g.build(c.reflector).canActivate(c.ctx)).resolves.toBe(true);
    expect(c.req.user).toMatchObject({ id: 'user-1' });
  });

  // The whole point: suspending or demoting a user has to reach the token they
  // are already holding, not just the next one they ask for.
  it('rejects a token issued before the revocation', async () => {
    const c = context();
    const g = guard(admin, NOW + 1);
    await expect(g.build(c.reflector).canActivate(c.ctx)).rejects.toMatchObject({ status: 401 });
  });

  // `iat` has one-second resolution, so a token minted in the same second as
  // the revocation must not slip through.
  it('rejects a token issued in the same second as the revocation', async () => {
    const c = context();
    const g = guard(admin, NOW);
    await expect(g.build(c.reflector).canActivate(c.ctx)).rejects.toMatchObject({ status: 401 });
  });

  it('admits everyone when the user has never been revoked', async () => {
    const c = context();
    const g = guard(admin, 0);
    await expect(g.build(c.reflector).canActivate(c.ctx)).resolves.toBe(true);
  });

  // Redis is the store; making every authenticated request fail when it blips
  // would trade a 15-minute staleness window for a full API outage. So the
  // check fails closed only where the window actually matters.
  it('503s a privileged token when the revocation store is unreachable', async () => {
    const c = context();
    const g = guard(admin, new Error('redis down'));
    await expect(g.build(c.reflector).canActivate(c.ctx)).rejects.toMatchObject({ status: 503 });
  });

  it('lets ordinary traffic through when the revocation store is unreachable', async () => {
    const c = context();
    const g = guard(student, new Error('redis down'));
    await expect(g.build(c.reflector).canActivate(c.ctx)).resolves.toBe(true);
  });

  it('skips the check entirely on a public route', async () => {
    const c = context(true);
    const g = guard(admin, NOW + 1);
    await expect(g.build(c.reflector).canActivate(c.ctx)).resolves.toBe(true);
    expect(g.revocation.revokedAt).not.toHaveBeenCalled();
  });

  it('still rejects a token that fails signature verification', async () => {
    const c = context();
    const g = guard(admin);
    g.jwt.verifyAsync.mockRejectedValue(new Error('bad signature'));
    await expect(g.build(c.reflector).canActivate(c.ctx)).rejects.toMatchObject({ status: 401 });
  });
});
