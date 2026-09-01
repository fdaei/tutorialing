// Set before importing AuthService: `authConfig()` is read in a field
// initializer, and `config()` caches its parse of the environment.
process.env.DATABASE_URL ??= 'postgresql://u:p@localhost:5432/db?schema=public';
process.env.JWT_ACCESS_SECRET ??= 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET ??= 'b'.repeat(32);
process.env.S3_ACCESS_KEY ??= 'minio';
process.env.S3_SECRET_KEY ??= 'secret';
process.env.S3_BUCKET ??= 'lingospeak';
process.env.GOOGLE_CLIENT_ID ??= 'lingospeak-test.apps.googleusercontent.com';
process.env.PROVIDER_TIMEOUT_MS ??= '2500';

const mockVerifyIdToken = jest.fn();
const mockClientOptions: unknown[] = [];

jest.mock('google-auth-library', () => ({
  OAuth2Client: class {
    verifyIdToken = mockVerifyIdToken;
    constructor(options: unknown) {
      mockClientOptions.push(options);
    }
  },
}));

const { AuthService } = require('./auth.service') as typeof import('./auth.service');

/**
 * SEC-214. `verifyGoogle` used to POST nothing and GET everything: the ID token
 * travelled to `oauth2.googleapis.com/tokeninfo` in the query string, where it
 * lands in access logs, tracing spans and every proxy on the way — and the
 * fetch carried no deadline, so a Google endpoint that accepted the connection
 * and then went quiet held the request open indefinitely.
 *
 * Verification is now local, against certificates the client caches.
 */

const PROFILE = {
  sub: 'google-sub-1',
  email: 'student@example.com',
  email_verified: true,
  name: 'Student',
  iss: 'https://accounts.google.com',
  aud: 'lingospeak-test.apps.googleusercontent.com',
};

function harness(payload: unknown) {
  mockVerifyIdToken.mockResolvedValue({ getPayload: () => payload });
  const db = {
    user: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'user-1' }),
      update: jest.fn().mockResolvedValue({ id: 'user-1' }),
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        id: 'user-1',
        phone: null,
        name: 'Student',
        locale: 'fa',
        timezone: 'Asia/Tehran',
        profileComplete: false,
        status: 'ACTIVE',
        roles: [],
      }),
    },
    refreshSession: { create: jest.fn().mockResolvedValue({}) },
  };
  const jwt = { signAsync: jest.fn().mockResolvedValue('access-token') };
  return { svc: new AuthService(db as never, jwt as never, {} as never), db };
}

describe('AuthService.verifyGoogle (SEC-214)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    mockVerifyIdToken.mockReset();
    mockClientOptions.length = 0;
    global.fetch = jest.fn();
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('never sends the credential over the network', async () => {
    const h = harness(PROFILE);
    await h.svc.verifyGoogle('an.id.token', {});
    // The whole point of local verification: no outbound request, and so no
    // chance of the token being logged by one.
    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockVerifyIdToken).toHaveBeenCalledWith({
      idToken: 'an.id.token',
      audience: 'lingospeak-test.apps.googleusercontent.com',
    });
  });

  it('bounds the certificate refresh with the configured provider deadline', async () => {
    const h = harness(PROFILE);
    await h.svc.verifyGoogle('an.id.token', {});
    expect(mockClientOptions[0]).toMatchObject({
      clientId: 'lingospeak-test.apps.googleusercontent.com',
      transporterOptions: { timeout: 2500 },
    });
  });

  it('reuses one client so the certificate cache survives between sign-ins', async () => {
    const h = harness(PROFILE);
    await h.svc.verifyGoogle('an.id.token', {});
    await h.svc.verifyGoogle('another.id.token', {});
    expect(mockClientOptions).toHaveLength(1);
  });

  it('answers a timed-out verification with a stable 401, not a crash or a hang', async () => {
    const h = harness(PROFILE);
    mockVerifyIdToken.mockRejectedValue(
      Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' }),
    );
    await expect(h.svc.verifyGoogle('an.id.token', {})).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'GOOGLE_TOKEN_INVALID' }),
    });
    expect(h.db.user.findFirst).not.toHaveBeenCalled();
  });

  it.each([
    ['an unverified email', { ...PROFILE, email_verified: false }],
    ['the tokeninfo string form of email_verified', { ...PROFILE, email_verified: 'true' }],
    ['no email at all', { ...PROFILE, email: undefined }],
    ['no subject', { ...PROFILE, sub: undefined }],
    ['an empty payload', undefined],
  ])('rejects a token with %s', async (_case, payload) => {
    const h = harness(payload);
    await expect(h.svc.verifyGoogle('an.id.token', {})).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'GOOGLE_TOKEN_INVALID' }),
    });
    expect(h.db.user.findFirst).not.toHaveBeenCalled();
  });

  it('keys the account on the Google subject, not the email', async () => {
    const h = harness(PROFILE);
    await h.svc.verifyGoogle('an.id.token', {});
    expect(h.db.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { OR: expect.arrayContaining([{ googleSubject: 'google-sub-1' }]) } }),
    );
    expect(h.db.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ googleSubject: 'google-sub-1' }) }),
    );
  });

  it('links an existing account through the matched user instead of creating a duplicate', async () => {
    const h = harness(PROFILE);
    h.db.user.findFirst.mockResolvedValueOnce({ id: 'user-1', googleSubject: null });

    await h.svc.verifyGoogle('an.id.token', {});

    expect(h.db.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { googleSubject: 'google-sub-1', email: 'student@example.com', name: 'Student' },
    });
    expect(h.db.user.create).not.toHaveBeenCalled();
  });
});

export {};
