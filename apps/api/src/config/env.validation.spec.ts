import { validate } from './env.validation';

const base = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db?schema=public',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  S3_ACCESS_KEY: 'minio',
  S3_SECRET_KEY: 'secret',
  S3_BUCKET: 'lingospeak',
};

/** Production additionally requires the real SMS and gateway credentials. */
const prod = { ...base, NODE_ENV: 'production', ZARINPAL_MERCHANT_ID: 'merchant-1', KAVENEGAR_API_KEY: 'sms-key' };

describe('AUTH_DEV_OTP', () => {
  it('defaults to off so an environment that forgets it never accepts the fixed code', () => {
    expect(validate(base).AUTH_DEV_OTP).toBe(false);
  });

  it('is enabled only by the explicit string "true"', () => {
    expect(validate({ ...base, AUTH_DEV_OTP: 'true' }).AUTH_DEV_OTP).toBe(true);
    expect(validate({ ...base, AUTH_DEV_OTP: 'false' }).AUTH_DEV_OTP).toBe(false);
    // A typo must fail loudly rather than fall back to a permissive default.
    expect(() => validate({ ...base, AUTH_DEV_OTP: 'yes' })).toThrow(/Config validation error/);
  });

  it('refuses to start when combined with production', () => {
    expect(() => validate({ ...prod, AUTH_DEV_OTP: 'true' })).toThrow(/AUTH_DEV_OTP/);
    expect(validate({ ...prod, AUTH_DEV_OTP: 'false' }).AUTH_DEV_OTP).toBe(false);
  });
});

describe('production provider credentials', () => {
  it('are optional outside production so local development needs no accounts', () => {
    expect(validate(base).ZARINPAL_MERCHANT_ID).toBeUndefined();
    expect(validate(base).KAVENEGAR_API_KEY).toBeUndefined();
  });

  it('refuses to start in production without the payment gateway merchant id', () => {
    // Without it GatewayService.verify() accepts any `dev_` authority as a real
    // capture, so forged callbacks would be treated as completed payments.
    const { ZARINPAL_MERCHANT_ID: _omitted, ...withoutGateway } = prod;
    expect(() => validate(withoutGateway)).toThrow(/ZARINPAL_MERCHANT_ID/);
  });

  it('refuses to use the Zarinpal sandbox in production', () => {
    expect(() => validate({ ...prod, ZARINPAL_SANDBOX: 'true' })).toThrow(/ZARINPAL_SANDBOX/);
  });

  it('refuses to start in production without the SMS key', () => {
    const { KAVENEGAR_API_KEY: _omitted, ...withoutSms } = prod;
    expect(() => validate(withoutSms)).toThrow(/KAVENEGAR_API_KEY/);
  });

  it('starts in production once both are configured', () => {
    expect(validate(prod).NODE_ENV).toBe('production');
  });
});

describe('TRUST_PROXY', () => {
  it('defaults to trusting no proxy', () => {
    expect(validate(base).TRUST_PROXY).toBe(0);
  });

  it('accepts a hop count and rejects nonsense', () => {
    expect(validate({ ...base, TRUST_PROXY: '1' }).TRUST_PROXY).toBe(1);
    expect(() => validate({ ...base, TRUST_PROXY: '-1' })).toThrow(/Config validation error/);
    expect(() => validate({ ...base, TRUST_PROXY: 'yes' })).toThrow(/Config validation error/);
  });
});
