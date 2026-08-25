import { createHash } from 'crypto';

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
