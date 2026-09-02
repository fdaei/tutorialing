/**
 * AUTH_OTP_ALLOWLIST — a temporary sign-in path for a named set of phones while
 * no SMS provider is configured.
 *
 * The property that matters most here is the *off* case: an empty allowlist has
 * to leave `requestOtp` bit-for-bit identical to what it did before the feature
 * existed. The alternative on offer was AUTH_DEV_OTP, which fixes every code at
 * a constant `123456` for every account — and the sample numbers it would be
 * used with are published in a public README, so an attacker knows exactly
 * which phone to point it at.
 */
const BASE_ENV: Record<string, string> = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db?schema=public',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  S3_ACCESS_KEY: 'minio',
  S3_SECRET_KEY: 'secret',
  S3_BUCKET: 'lingospeak',
  NODE_ENV: 'test',
  // Set explicitly rather than left to default: apps/api/.env carries
  // AUTH_DEV_OTP=true for local development and dotenv loads it into the test
  // process, so an unset variable here would not mean "off".
  AUTH_DEV_OTP: 'false',
};

const LISTED = '+989120000000';
const SECOND = '+989121111111';
const STRANGER = '+989350000001';
const CODE = '4820391756';

const MANAGED = ['AUTH_OTP_ALLOWLIST', 'AUTH_OTP_ALLOWLIST_CODE', 'AUTH_DEV_OTP'];

function load(overrides: Record<string, string> = {}) {
  jest.resetModules();
  for (const key of MANAGED) delete process.env[key];
  for (const [key, value] of Object.entries({ ...BASE_ENV, ...overrides })) process.env[key] = value;

  // Required after the environment is in place: `config()` memoises its parse
  // and AuthService reads `authConfig()` once, at construction.
  const { AuthService } = require('./auth.service') as typeof import('./auth.service');
  const sms = { sendOtp: jest.fn().mockResolvedValue({}) };
  const db = {
    otpChallenge: {
      findFirst: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
      create: jest
        .fn()
        .mockImplementation(({ data }: { data: object }) => Promise.resolve({ id: 'challenge-1', ...data })),
    },
    user: { upsert: jest.fn().mockResolvedValue({ id: 'user-1' }) },
  };
  return { svc: new AuthService(db as never, {} as never, sms as never), sms };
}

const issued = (sms: { sendOtp: jest.Mock }) => sms.sendOtp.mock.calls[0][1] as string;
const bypassed = (sms: { sendOtp: jest.Mock }) => sms.sendOtp.mock.calls[0][3] as boolean | undefined;

describe('with no allowlist configured', () => {
  it('issues a random six-digit code and asks for real delivery', async () => {
    const { svc, sms } = load();
    await svc.requestOtp(LISTED);
    expect(issued(sms)).toMatch(/^\d{6}$/);
    expect(bypassed(sms)).toBe(false);
  });

  it('behaves the same for every number, including ones a later allowlist would name', async () => {
    const first = load();
    await first.svc.requestOtp(LISTED);
    const second = load();
    await second.svc.requestOtp(STRANGER);
    for (const harness of [first, second]) {
      expect(issued(harness.sms)).toMatch(/^\d{6}$/);
      expect(issued(harness.sms)).not.toBe(CODE);
      expect(bypassed(harness.sms)).toBe(false);
    }
  });

  it('leaves the development OTP path untouched', async () => {
    const { svc, sms } = load({ AUTH_DEV_OTP: 'true' });
    await svc.requestOtp(LISTED);
    expect(issued(sms)).toBe('123456');
    expect(bypassed(sms)).toBe(false);
  });
});

describe('with an allowlist configured', () => {
  const on = (overrides: Record<string, string> = {}) =>
    load({ AUTH_OTP_ALLOWLIST: `${LISTED},${SECOND}`, AUTH_OTP_ALLOWLIST_CODE: CODE, ...overrides });

  it('gives a listed number the configured code and skips delivery', async () => {
    const { svc, sms } = on();
    await svc.requestOtp(LISTED);
    expect(issued(sms)).toBe(CODE);
    expect(bypassed(sms)).toBe(true);
  });

  it('covers every entry in the list, not just the first', async () => {
    const { svc, sms } = on();
    await svc.requestOtp(SECOND);
    expect(issued(sms)).toBe(CODE);
    expect(bypassed(sms)).toBe(true);
  });

  it('leaves an unlisted number on the normal random path', async () => {
    const { svc, sms } = on();
    await svc.requestOtp(STRANGER);
    expect(issued(sms)).toMatch(/^\d{6}$/);
    expect(issued(sms)).not.toBe(CODE);
    expect(bypassed(sms)).toBe(false);
  });

  it('tolerates spaces around entries', async () => {
    const { svc, sms } = load({
      AUTH_OTP_ALLOWLIST: `  ${LISTED} ,  ${SECOND}  `,
      AUTH_OTP_ALLOWLIST_CODE: CODE,
    });
    await svc.requestOtp(LISTED);
    expect(issued(sms)).toBe(CODE);
  });

  it('does not match a locally-formatted spelling of a listed number', async () => {
    // requestOtp only ever sees E.164 (RequestOtpDto enforces it), so this is
    // defence in depth rather than a reachable path — but a future caller that
    // skipped the DTO must not get the fixed code by accident.
    const { svc, sms } = on();
    await svc.requestOtp('09120000000');
    expect(issued(sms)).not.toBe(CODE);
    expect(bypassed(sms)).toBe(false);
  });
});
