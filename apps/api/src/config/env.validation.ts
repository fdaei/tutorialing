import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('4001'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  API_URL: z.string().url().default('http://localhost:4001'),
  WEB_URL: z.string().url().default('http://localhost:3000'),
  S3_ENDPOINT: z.string().url().default('http://localhost:9000'),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  KAVENEGAR_API_KEY: z.string().optional(),
  ZARINPAL_MERCHANT_ID: z.string().optional(),
  // Opt-in switch for the fixed local-development OTP (`123456`) and for
  // echoing that code back in the API response. It defaults to off so any
  // environment that forgets to configure it issues real random codes over a
  // real SMS provider instead of silently accepting a well-known one.
  AUTH_DEV_OTP: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  // Number of reverse proxies in front of the API. Per-IP rate limiting reads
  // `request.ip`, which only reflects the real client once Express is told how
  // many X-Forwarded-For hops to trust. Left at 0 (the default) a proxied
  // deployment buckets every client together; set too high, clients can spoof
  // the header and evade the limiter entirely — so it must match the actual
  // deployment topology.
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
});

export const envSchemaWithGuards = envSchema.superRefine((env, ctx) => {
  if (env.NODE_ENV === 'production' && env.AUTH_DEV_OTP) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['AUTH_DEV_OTP'],
      message: 'AUTH_DEV_OTP must not be enabled when NODE_ENV=production',
    });
  }
  // Both providers fall back to a development adapter when their credential is
  // absent. For the payment gateway that fallback accepts any `dev_` authority
  // as a verified capture, so a production deploy that forgets the merchant ID
  // would treat forged callbacks as real payments. Startup fails instead.
  if (env.NODE_ENV === 'production' && !env.ZARINPAL_MERCHANT_ID) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['ZARINPAL_MERCHANT_ID'],
      message: 'ZARINPAL_MERCHANT_ID is required when NODE_ENV=production: without it the payment gateway accepts unverified development callbacks',
    });
  }
  if (env.NODE_ENV === 'production' && !env.KAVENEGAR_API_KEY) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['KAVENEGAR_API_KEY'],
      message: 'KAVENEGAR_API_KEY is required when NODE_ENV=production: without it OTP and reminder SMS are only logged, never delivered',
    });
  }
});

export function validate(config: Record<string, unknown>) {
  const parsed = envSchemaWithGuards.safeParse(config);
  if (!parsed.success) {
    throw new Error(`Config validation error: ${parsed.error.message}`);
  }
  return parsed.data;
}
