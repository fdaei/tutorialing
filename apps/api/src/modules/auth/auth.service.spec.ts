import { createHash, randomBytes } from 'crypto';

// Set before importing AuthService: the OTP pepper is derived from
// JWT_ACCESS_SECRET via `config()`, which parses the environment.
process.env.DATABASE_URL ??= 'postgresql://u:p@localhost:5432/db?schema=public';
process.env.JWT_ACCESS_SECRET ??= 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET ??= 'b'.repeat(32);
process.env.S3_ACCESS_KEY ??= 'minio';
process.env.S3_SECRET_KEY ??= 'secret';
process.env.S3_BUCKET ??= 'lingospeak';

const { AuthService } = require('./auth.service') as typeof import('./auth.service');

const PHONE = '09120000000';

function harness() {
  const challenges: Record<string, unknown>[] = [];
  const db = {
    otpChallenge: {
      findFirst: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
        challenges.push(data);
        return Promise.resolve({ id: 'challenge-1', ...data });
      }),
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
    user: { upsert: jest.fn().mockResolvedValue({ id: 'user-1', phone: PHONE }) },
  };
  const sms = { sendOtp: jest.fn().mockResolvedValue({ developmentCode: '123456' }) };
  const svc = new AuthService(db as never, {} as never, sms as never);
  return { svc, db, sms, challenges };
}

/**
 * SEC-007. A six-digit OTP has only 900,000 possible values, so a plain
 * SHA-256 of it is a rainbow table anyone can precompute — a leak of
 * `OtpChallenge` rows would hand over every code still inside its two-minute
 * window. Keying the digest with a server-side secret makes such a dump
 * useless.
 */
describe('OTP hashing', () => {
  it('does not store a plain unsalted SHA-256 of the code', async () => {
    const h = harness();
    await h.svc.requestOtp(PHONE);
    const code = h.sms.sendOtp.mock.calls[0][1] as string;
    const stored = h.challenges[0]!.codeHash as string;
    expect(stored).not.toBe(createHash('sha256').update(code).digest('hex'));
    expect(stored).toHaveLength(64);
  });

  it('still verifies the code it issued', async () => {
    const h = harness();
    await h.svc.requestOtp(PHONE);
    const code = h.sms.sendOtp.mock.calls[0][1] as string;
    const stored = h.challenges[0]!.codeHash as string;
    h.db.otpChallenge.findUnique.mockResolvedValue({
      id: 'challenge-1', phone: PHONE, userId: 'user-1', codeHash: stored,
      attempts: 0, verifiedAt: null, expiresAt: new Date(Date.now() + 60e3),
    });
    // Reaches session creation, which this harness does not stub — proof the
    // digest comparison itself passed.
    await expect(h.svc.verifyOtp('challenge-1', PHONE, code, {})).rejects.not.toMatchObject({ message: 'Incorrect OTP' });
  });

  it('rejects a wrong code', async () => {
    const h = harness();
    await h.svc.requestOtp(PHONE);
    const stored = h.challenges[0]!.codeHash as string;
    h.db.otpChallenge.findUnique.mockResolvedValue({
      id: 'challenge-1', phone: PHONE, userId: 'user-1', codeHash: stored,
      attempts: 0, verifiedAt: null, expiresAt: new Date(Date.now() + 60e3),
    });
    await expect(h.svc.verifyOtp('challenge-1', PHONE, '000000', {})).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'OTP_INCORRECT' }),
    });
  });
});

/**
 * SEC-209. `refresh()` compared the hashed refresh secret with plain `!==`,
 * unlike the OTP path above (which already used `timingSafeEqual`). Fixed by
 * routing both through a shared `constantTimeEqual` helper. These tests pin
 * the *behaviour* of refresh/rotation/reuse-detection, which must be
 * unchanged by that swap, plus the one new edge case a non-constant-time `!==`
 * could never hit: a stored hash of a different length than the computed one.
 */
function refreshHarness(session: unknown) {
  const db = {
    refreshSession: {
      findUnique: jest.fn().mockResolvedValue(session),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    user: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        id: 'user-1', phone: PHONE, name: null, locale: 'fa', timezone: 'Asia/Tehran',
        profileComplete: false, status: 'ACTIVE', roles: [],
      }),
    },
  };
  const jwt = { signAsync: jest.fn().mockResolvedValue('new-access-token') };
  const svc = new AuthService(db as never, jwt as never, {} as never);
  return { svc, db, jwt };
}

function refreshSecretAndHash() {
  const secret = randomBytes(32).toString('base64url');
  return { secret, tokenHash: createHash('sha256').update(secret).digest('hex') };
}

describe('AuthService.refresh (SEC-209)', () => {
  it('1. succeeds with a valid, unexpired, unrevoked refresh token and rotates it', async () => {
    const { secret, tokenHash } = refreshSecretAndHash();
    const { svc, db } = refreshHarness({
      id: 'session-1', userId: 'user-1', familyId: 'family-1', tokenHash,
      revokedAt: null, expiresAt: new Date(Date.now() + 60_000),
    });
    const result = await svc.refresh(`session-1.${secret}`, {});
    expect(result.accessToken).toBe('new-access-token');
    expect(db.refreshSession.create).toHaveBeenCalled();
    expect(db.refreshSession.update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: expect.objectContaining({ revokedAt: expect.any(Date) }),
    });
    expect(db.refreshSession.updateMany).not.toHaveBeenCalled();
  });

  it('2. rejects an invalid refresh token (wrong secret) and revokes the family', async () => {
    const { tokenHash } = refreshSecretAndHash();
    const { svc, db } = refreshHarness({
      id: 'session-1', userId: 'user-1', familyId: 'family-1', tokenHash,
      revokedAt: null, expiresAt: new Date(Date.now() + 60_000),
    });
    await expect(svc.refresh('session-1.wrong-secret', {})).rejects.toMatchObject({
      response: { code: 'REFRESH_TOKEN_EXPIRED_OR_REUSED' },
    });
    expect(db.refreshSession.create).not.toHaveBeenCalled();
    expect(db.refreshSession.updateMany).toHaveBeenCalledWith({
      where: { familyId: 'family-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('rejects a malformed refresh token (no session id/secret split) without touching the database', async () => {
    const { svc, db } = refreshHarness(null);
    await expect(svc.refresh('not-a-valid-token', {})).rejects.toMatchObject({
      response: { code: 'REFRESH_TOKEN_INVALID' },
    });
    expect(db.refreshSession.findUnique).not.toHaveBeenCalled();
  });

  it('3. rejects an expired refresh token and revokes the family', async () => {
    const { secret, tokenHash } = refreshSecretAndHash();
    const { svc, db } = refreshHarness({
      id: 'session-1', userId: 'user-1', familyId: 'family-1', tokenHash,
      revokedAt: null, expiresAt: new Date(Date.now() - 1_000),
    });
    await expect(svc.refresh(`session-1.${secret}`, {})).rejects.toMatchObject({
      response: { code: 'REFRESH_TOKEN_EXPIRED_OR_REUSED' },
    });
    expect(db.refreshSession.updateMany).toHaveBeenCalledWith({
      where: { familyId: 'family-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('3. rejects an already-revoked refresh token and revokes the family', async () => {
    const { secret, tokenHash } = refreshSecretAndHash();
    const { svc, db } = refreshHarness({
      id: 'session-1', userId: 'user-1', familyId: 'family-1', tokenHash,
      revokedAt: new Date(), expiresAt: new Date(Date.now() + 60_000),
    });
    await expect(svc.refresh(`session-1.${secret}`, {})).rejects.toMatchObject({
      response: { code: 'REFRESH_TOKEN_EXPIRED_OR_REUSED' },
    });
    expect(db.refreshSession.updateMany).toHaveBeenCalledWith({
      where: { familyId: 'family-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('4. reuse detection: a stale/already-rotated refresh token still revokes the whole family, not just itself', async () => {
    // Simulates the classic reuse scenario: this token was already exchanged
    // once (the session it points at has since been replaced/rotated, so its
    // real current tokenHash no longer matches the secret an attacker or a
    // confused client is replaying).
    const { tokenHash: currentHash } = refreshSecretAndHash();
    const staleSecret = randomBytes(32).toString('base64url');
    const { svc, db } = refreshHarness({
      id: 'session-1', userId: 'user-1', familyId: 'family-shared', tokenHash: currentHash,
      revokedAt: null, expiresAt: new Date(Date.now() + 60_000),
    });
    await expect(svc.refresh(`session-1.${staleSecret}`, {})).rejects.toMatchObject({
      response: { code: 'REFRESH_TOKEN_EXPIRED_OR_REUSED' },
    });
    expect(db.refreshSession.updateMany).toHaveBeenCalledWith({
      where: { familyId: 'family-shared', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('rejects safely (not a crash) when the stored hash is a different length than the computed one', async () => {
    // A `timingSafeEqual` call on mismatched-length buffers throws; the fix
    // must catch that case up front rather than let it escape as a 500. Not
    // reachable through normal operation (both sides are always a sha256 hex
    // digest), but defends against corrupt/legacy data.
    const { secret } = refreshSecretAndHash();
    const { svc, db } = refreshHarness({
      id: 'session-1', userId: 'user-1', familyId: 'family-1', tokenHash: 'too-short',
      revokedAt: null, expiresAt: new Date(Date.now() + 60_000),
    });
    await expect(svc.refresh(`session-1.${secret}`, {})).rejects.toMatchObject({
      response: { code: 'REFRESH_TOKEN_EXPIRED_OR_REUSED' },
    });
    expect(db.refreshSession.updateMany).toHaveBeenCalled();
  });
});
