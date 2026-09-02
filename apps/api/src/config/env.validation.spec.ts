import { validate } from './env.validation';

const base = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db?schema=public',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  S3_ACCESS_KEY: 'minio',
  S3_SECRET_KEY: 'secret',
  S3_BUCKET: 'lingospeak',
};

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

describe('AUTH_OTP_ALLOWLIST', () => {
  it('cannot bypass SMS delivery in production', () => {
    expect(() =>
      validate({ ...prod, AUTH_OTP_ALLOWLIST: '+12025550100', AUTH_OTP_ALLOWLIST_CODE: '4820391756' }),
    ).toThrow(/AUTH_OTP_ALLOWLIST/);
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

describe('structured logging', () => {
  it('uses production-safe defaults', () => {
    const env = validate(base);
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.LOG_PRETTY).toBe(false);
    expect(env.LOG_HTTP).toBe(true);
    expect(env.LOG_HEALTH_REQUESTS).toBe(false);
  });

  it('rejects unknown log levels and malformed boolean switches', () => {
    expect(() => validate({ ...base, LOG_LEVEL: 'verbose-ish' })).toThrow(/Config validation error/);
    expect(() => validate({ ...base, LOG_PRETTY: 'yes' })).toThrow(/Config validation error/);
  });
});
