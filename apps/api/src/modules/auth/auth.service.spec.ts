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
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
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
      id: 'challenge-1',
      phone: PHONE,
      userId: 'user-1',
      codeHash: stored,
      attempts: 0,
      verifiedAt: null,
      expiresAt: new Date(Date.now() + 60e3),
    });
    // Reaches session creation, which this harness does not stub — proof the
    // digest comparison itself passed.
    await expect(h.svc.verifyOtp('challenge-1', PHONE, code, {})).rejects.not.toMatchObject({
      message: 'Incorrect OTP',
    });
  });

  it('rejects a wrong code', async () => {
    const h = harness();
    await h.svc.requestOtp(PHONE);
    const stored = h.challenges[0]!.codeHash as string;
    h.db.otpChallenge.findUnique.mockResolvedValue({
      id: 'challenge-1',
      phone: PHONE,
      userId: 'user-1',
      codeHash: stored,
      attempts: 0,
      verifiedAt: null,
      expiresAt: new Date(Date.now() + 60e3),
    });
    await expect(h.svc.verifyOtp('challenge-1', PHONE, '000000', {})).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'OTP_INCORRECT' }),
    });
  });
});

describe('password authentication', () => {
  it('registers with a salted hash and can verify the password', async () => {
    let storedUser: Record<string, unknown> | null = null;
    const db = {
      user: {
        findFirst: jest.fn().mockImplementation(() => Promise.resolve(storedUser)),
        create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
          storedUser = { id: 'password-user', status: 'ACTIVE', ...data };
          return Promise.resolve(storedUser);
        }),
      },
    };
    const svc = new AuthService(db as never, {} as never, {} as never);
    jest.spyOn(svc as never, 'createSession').mockResolvedValue({ accessToken: 'token' } as never);

    await svc.registerWithPassword('کاربر تست', 'User@Example.com', 'correct-horse', {});
    const saved = db.user.create.mock.calls[0]![0].data as Record<string, unknown>;
    expect(saved.email).toBe('user@example.com');
    expect(saved.passwordHash).not.toBe('correct-horse');
    expect(String(saved.passwordHash)).toMatch(/^scrypt\$/);
    await expect(svc.loginWithPassword('USER@example.com', 'correct-horse', {})).resolves.toMatchObject({
      accessToken: 'token',
    });
    await expect(svc.loginWithPassword('user@example.com', 'wrong-password', {})).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'INVALID_CREDENTIALS' }),
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
const ACTIVE_USER = {
  id: 'user-1',
  phone: PHONE,
  name: null,
  locale: 'fa',
  timezone: 'Asia/Tehran',
  profileComplete: false,
  status: 'ACTIVE',
  roles: [],
};

const CLAIM_WHERE = { id: 'session-1', revokedAt: null, expiresAt: { gt: expect.any(Date) } };

function refreshHarness(session: unknown, claimedRows = 1) {
  const db: Record<string, unknown> = {
    refreshSession: {
      findUnique: jest.fn().mockResolvedValue(session),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      // Both the rotation claim and `revokeFamily` are `updateMany`; the claim
      // is the one filtered by session id, so assertions match on `where`.
      updateMany: jest
        .fn()
        .mockImplementation(({ where }: { where: { familyId?: string } }) =>
          Promise.resolve({ count: where.familyId ? 1 : claimedRows }),
        ),
    },
    user: { findUniqueOrThrow: jest.fn().mockResolvedValue(ACTIVE_USER) },
  };
  // `refresh()` rotates inside `$transaction`; the mock hands the same client
  // back as the transaction client.
  db.$transaction = jest.fn((run: (tx: unknown) => unknown) => run(db));
  const jwt = { signAsync: jest.fn().mockResolvedValue('new-access-token') };
  const svc = new AuthService(db as never, jwt as never, {} as never);
  return {
    svc,
    db: db as never as {
      refreshSession: Record<'findUnique' | 'create' | 'update' | 'updateMany', jest.Mock>;
      user: { findUniqueOrThrow: jest.Mock };
      $transaction: jest.Mock;
    },
    jwt,
  };
}

function refreshSecretAndHash() {
  const secret = randomBytes(32).toString('base64url');
  return { secret, tokenHash: createHash('sha256').update(secret).digest('hex') };
}

describe('AuthService.refresh (SEC-209)', () => {
  it('1. succeeds with a valid, unexpired, unrevoked refresh token and rotates it', async () => {
    const { secret, tokenHash } = refreshSecretAndHash();
    const { svc, db } = refreshHarness({
      id: 'session-1',
      userId: 'user-1',
      familyId: 'family-1',
      tokenHash,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    const result = await svc.refresh(`session-1.${secret}`, {});
    expect(result.accessToken).toBe('new-access-token');
    expect(db.refreshSession.create).toHaveBeenCalled();
    // The revocation *is* the claim, and it only matches a session that is
    // still unrevoked and unexpired.
    expect(db.refreshSession.updateMany).toHaveBeenCalledWith({
      where: CLAIM_WHERE,
      data: { revokedAt: expect.any(Date) },
    });
    expect(db.refreshSession.update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: { replacedById: expect.any(String) },
    });
    // Rotation must be one transaction, not three loose statements (SEC-211).
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
  });

  it('2. rejects an invalid refresh token (wrong secret) and revokes the family', async () => {
    const { tokenHash } = refreshSecretAndHash();
    const { svc, db } = refreshHarness({
      id: 'session-1',
      userId: 'user-1',
      familyId: 'family-1',
      tokenHash,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
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
      id: 'session-1',
      userId: 'user-1',
      familyId: 'family-1',
      tokenHash,
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1_000),
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
      id: 'session-1',
      userId: 'user-1',
      familyId: 'family-1',
      tokenHash,
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
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
      id: 'session-1',
      userId: 'user-1',
      familyId: 'family-shared',
      tokenHash: currentHash,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
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
      id: 'session-1',
      userId: 'user-1',
      familyId: 'family-1',
      tokenHash: 'too-short',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    await expect(svc.refresh(`session-1.${secret}`, {})).rejects.toMatchObject({
      response: { code: 'REFRESH_TOKEN_EXPIRED_OR_REUSED' },
    });
    expect(db.refreshSession.updateMany).toHaveBeenCalled();
  });
});

/**
 * SEC-211. Rotation used to read the session, mint its replacement, and revoke
 * the original as three separate statements, so two requests carrying one
 * refresh token could both pass the `revokedAt` check and both mint a session.
 *
 * These drive two `refresh()` calls concurrently against a shared row whose
 * `updateMany` behaves like the Postgres statement it stands for: it matches
 * only a session that is still unrevoked, and the first caller to match takes
 * it. Both ways Postgres can report the loss are covered — a serialization
 * failure (what Serializable actually raises) and zero matched rows (what a
 * weakened isolation level would leave the claim to catch on its own).
 */
type Conflict = 'serialization-failure' | 'no-rows';

function racingHarness(tokenHash: string, conflict: Conflict) {
  const row = {
    id: 'session-1',
    userId: 'user-1',
    familyId: 'family-1',
    tokenHash,
    revokedAt: null as Date | null,
    expiresAt: new Date(Date.now() + 60_000),
  };
  const createdSessionIds: string[] = [];
  const db: Record<string, unknown> = {
    refreshSession: {
      findUnique: jest.fn(() => Promise.resolve({ ...row })),
      create: jest.fn(({ data }: { data: { id: string } }) => {
        createdSessionIds.push(data.id);
        return Promise.resolve(data);
      }),
      update: jest.fn(() => Promise.resolve({})),
      updateMany: jest.fn(({ where, data }: { where: { familyId?: string }; data: { revokedAt: Date } }) => {
        if (where.familyId) {
          row.revokedAt ??= data.revokedAt;
          return Promise.resolve({ count: 1 });
        }
        if (row.revokedAt) {
          if (conflict === 'serialization-failure') {
            return Promise.reject(Object.assign(new Error('could not serialize access'), { code: 'P2034' }));
          }
          return Promise.resolve({ count: 0 });
        }
        row.revokedAt = data.revokedAt;
        return Promise.resolve({ count: 1 });
      }),
    },
    user: { findUniqueOrThrow: jest.fn().mockResolvedValue(ACTIVE_USER) },
  };
  db.$transaction = jest.fn((run: (tx: unknown) => unknown) => run(db));
  const jwt = { signAsync: jest.fn().mockResolvedValue('new-access-token') };
  const svc = new AuthService(db as never, jwt as never, {} as never);
  return {
    svc,
    row,
    createdSessionIds,
    db: db as never as { refreshSession: { create: jest.Mock; updateMany: jest.Mock } },
  };
}

describe.each<Conflict>(['serialization-failure', 'no-rows'])(
  'AuthService.refresh concurrency (SEC-211, loser sees %s)',
  (conflict) => {
    it('rotates exactly once and answers the loser with reuse detection', async () => {
      const { secret, tokenHash } = refreshSecretAndHash();
      const { svc, createdSessionIds, db } = racingHarness(tokenHash, conflict);
      const token = `session-1.${secret}`;

      const outcomes = await Promise.allSettled([svc.refresh(token, {}), svc.refresh(token, {})]);
      const fulfilled = outcomes.filter((o) => o.status === 'fulfilled');
      const rejected = outcomes.filter((o) => o.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({
        response: { code: 'REFRESH_TOKEN_EXPIRED_OR_REUSED' },
      });
      // The whole point: one refresh token yields one new session, never two.
      expect(createdSessionIds).toHaveLength(1);
      expect(db.refreshSession.create).toHaveBeenCalledTimes(1);
      // Reuse detection still takes the family down with it.
      expect(db.refreshSession.updateMany).toHaveBeenCalledWith({
        where: { familyId: 'family-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });
  },
);

/**
 * SEC-212. `verifyOtp` checked `verifiedAt` and then set it in a separate
 * statement, so two requests carrying the same correct code could both find
 * the challenge unverified and both mint a session — one OTP opening two.
 *
 * The claim is now a single `updateMany` guarded on everything a concurrent
 * request can move (`verifiedAt`, `expiresAt`, `attempts`), and only the caller
 * that actually moved the row gets a session.
 */
function otpRaceHarness(codeHash: string) {
  const challenge = {
    id: 'challenge-1',
    phone: PHONE,
    userId: 'user-1',
    codeHash,
    attempts: 0,
    verifiedAt: null as Date | null,
    expiresAt: new Date(Date.now() + 60_000),
  };
  const createdSessionIds: string[] = [];
  const db: Record<string, unknown> = {
    otpChallenge: {
      findUnique: jest.fn(() => Promise.resolve({ ...challenge })),
      update: jest.fn(() => Promise.resolve({})),
      // Stands in for the Postgres statement: it matches only a challenge that
      // is still unverified, and the first caller to match it takes it.
      updateMany: jest.fn(({ data }: { data: { verifiedAt: Date } }) => {
        if (challenge.verifiedAt) return Promise.resolve({ count: 0 });
        challenge.verifiedAt = data.verifiedAt;
        return Promise.resolve({ count: 1 });
      }),
    },
    refreshSession: {
      create: jest.fn(({ data }: { data: { id: string } }) => {
        createdSessionIds.push(data.id);
        return Promise.resolve(data);
      }),
    },
    user: { findUniqueOrThrow: jest.fn().mockResolvedValue(ACTIVE_USER) },
  };
  const jwt = { signAsync: jest.fn().mockResolvedValue('new-access-token') };
  const svc = new AuthService(db as never, jwt as never, {} as never);
  return { svc, createdSessionIds, db: db as never as { otpChallenge: { updateMany: jest.Mock } } };
}

describe('AuthService.verifyOtp concurrency (SEC-212)', () => {
  it('lets exactly one of two simultaneous verifications of the same correct code create a session', async () => {
    const h = harness();
    await h.svc.requestOtp(PHONE);
    const code = h.sms.sendOtp.mock.calls[0][1] as string;
    const codeHash = h.challenges[0]!.codeHash as string;

    const { svc, createdSessionIds } = otpRaceHarness(codeHash);
    const outcomes = await Promise.allSettled([
      svc.verifyOtp('challenge-1', PHONE, code, {}),
      svc.verifyOtp('challenge-1', PHONE, code, {}),
    ]);

    expect(outcomes.filter((o) => o.status === 'fulfilled')).toHaveLength(1);
    const rejected = outcomes.filter((o) => o.status === 'rejected');
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({
      response: expect.objectContaining({ code: 'OTP_INVALID_OR_EXPIRED' }),
    });
    expect(createdSessionIds).toHaveLength(1);
  });

  it('claims the challenge with every mutable guard restated, not just its id', async () => {
    const h = harness();
    await h.svc.requestOtp(PHONE);
    const code = h.sms.sendOtp.mock.calls[0][1] as string;
    const codeHash = h.challenges[0]!.codeHash as string;

    const { svc, db } = otpRaceHarness(codeHash);
    await svc.verifyOtp('challenge-1', PHONE, code, {});

    expect(db.otpChallenge.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'challenge-1',
        verifiedAt: null,
        expiresAt: { gt: expect.any(Date) },
        attempts: { lt: expect.any(Number) },
      },
      data: { verifiedAt: expect.any(Date) },
    });
  });
});
