import { validate } from './env.validation';

const base = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db?schema=public',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  S3_ACCESS_KEY: 'minio',
  S3_SECRET_KEY: 'secret',
  S3_BUCKET: 'lingospeak',
};

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
    expect(() => validate({ ...base, NODE_ENV: 'production', AUTH_DEV_OTP: 'true' })).toThrow(/AUTH_DEV_OTP/);
    expect(validate({ ...base, NODE_ENV: 'production', AUTH_DEV_OTP: 'false' }).AUTH_DEV_OTP).toBe(false);
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
