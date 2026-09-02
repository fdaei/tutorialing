import { z } from 'zod';
import { defaultConfig } from './defaults';

const booleanDefault = (value: boolean): 'true' | 'false' => (value ? 'true' : 'false');

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default(defaultConfig.app.nodeEnv),
  PORT: z.string().default(defaultConfig.app.port),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().default(defaultConfig.redis.url),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().min(1).default(defaultConfig.auth.accessTokenTtl),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(defaultConfig.auth.accessTokenTtlSeconds),
  JWT_REFRESH_TTL_SECONDS: z.coerce.number().int().positive().default(defaultConfig.auth.refreshTokenTtlSeconds),
  AUTH_OTP_TTL_SECONDS: z.coerce.number().int().positive().default(defaultConfig.auth.otpTtlSeconds),
  AUTH_OTP_RESEND_SECONDS: z.coerce.number().int().positive().default(defaultConfig.auth.otpResendSeconds),
  AUTH_OTP_RECENT_REQUEST_WINDOW_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(defaultConfig.auth.otpRecentRequestWindowSeconds),
  AUTH_OTP_HOURLY_WINDOW_SECONDS: z.coerce.number().int().positive().default(defaultConfig.auth.otpHourlyWindowSeconds),
  AUTH_OTP_HOURLY_LIMIT: z.coerce.number().int().positive().default(defaultConfig.auth.otpHourlyLimit),
  AUTH_OTP_ATTEMPT_LIMIT: z.coerce.number().int().positive().default(defaultConfig.auth.otpAttemptLimit),
  // Temporary sign-in path for a named set of phones while no SMS provider is
  // configured. Deliberately narrower than AUTH_DEV_OTP, which fixes the code
  // at a well-known `123456` for *every* account: here the fixed code reaches
  // only the numbers listed here, and its value comes from
  // AUTH_OTP_ALLOWLIST_CODE rather than from a constant in the source. Empty —
  // the default — makes the whole feature inert and every phone follows the
  // normal provider path.
  //
  // Entries are compared against the phone as it arrives at
  // `AuthService.requestOtp`, which `RequestOtpDto` has already forced into
  // E.164 (`IsInternationalPhone`), so the same shape is required here; a
  // locally-formatted `0912…` would silently never match.
  AUTH_OTP_ALLOWLIST: z
    .string()
    .default(defaultConfig.auth.otpAllowlist)
    .transform((value) => [...new Set(value.split(',').map((entry) => entry.trim()).filter(Boolean))])
    .superRefine((phones, ctx) => {
      for (const phone of phones) {
        // Kept in sync with common/validators/is-international-phone.decorator.ts.
        // Duplicated rather than imported so this module stays free of Nest and
        // class-validator: it is parsed before the container exists.
        if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `AUTH_OTP_ALLOWLIST entry "${phone}" is not E.164 (a leading + followed by 8-15 digits)`,
          });
        }
      }
    }),
  // At least 8 digits: a 6-digit code is the length the normal random path
  // uses, and this one is long-lived rather than valid for two minutes, so it
  // has to be far outside brute-force range for the rate limiter to matter.
  AUTH_OTP_ALLOWLIST_CODE: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z
      .string()
      .regex(/^\d{8,}$/, 'AUTH_OTP_ALLOWLIST_CODE must be all digits and at least 8 of them')
      .optional(),
  ),
  GOOGLE_CLIENT_ID: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().min(10).optional(),
  ),
  API_URL: z.string().url().default(defaultConfig.app.apiUrl),
  WEB_URL: z.string().url().default(defaultConfig.app.webUrl),
  S3_ENDPOINT: z.string().url().default(defaultConfig.storage.endpoint),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_REGION: z.string().min(1).default(defaultConfig.storage.region),
  S3_FORCE_PATH_STYLE: z
    .enum(['true', 'false'])
    .default(booleanDefault(defaultConfig.storage.forcePathStyle))
    .transform((value) => value === 'true'),
  FILE_MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(defaultConfig.storage.maxUploadBytes),
  FILE_UPLOAD_URL_TTL_SECONDS: z.coerce.number().int().positive().default(defaultConfig.storage.uploadUrlTtlSeconds),
  FILE_DOWNLOAD_URL_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(defaultConfig.storage.downloadUrlTtlSeconds),
  PROVIDER_TIMEOUT_MS: z.coerce.number().int().positive().default(defaultConfig.providers.timeoutMs),
  HEALTH_CHECK_TIMEOUT_MS: z.coerce.number().int().positive().default(defaultConfig.health.checkTimeoutMs),
  DASHBOARD_STATS_RECONCILIATION_INTERVAL_MS: z.coerce
    .number()
    .int()
    .min(60_000)
    .default(defaultConfig.dashboard.reconciliationIntervalMs),
  SERVICE_NAME: z.string().min(1).default(defaultConfig.health.serviceName),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default(defaultConfig.logging.level),
  LOG_PRETTY: z
    .enum(['true', 'false'])
    .default(booleanDefault(defaultConfig.logging.pretty))
    .transform((value) => value === 'true'),
  LOG_HTTP: z
    .enum(['true', 'false'])
    .default(booleanDefault(defaultConfig.logging.http))
    .transform((value) => value === 'true'),
  LOG_HEALTH_REQUESTS: z
    .enum(['true', 'false'])
    .default(booleanDefault(defaultConfig.logging.healthRequests))
    .transform((value) => value === 'true'),
  KAVENEGAR_API_KEY: z.string().optional(),
  KAVENEGAR_API_BASE: z.string().url().default(defaultConfig.sms.apiBase),
  KAVENEGAR_OTP_TEMPLATE: z.string().min(1).default(defaultConfig.sms.otpTemplate),
  KAVENEGAR_REMINDER_TEMPLATE: z.string().min(1).default(defaultConfig.sms.reminderTemplate),
  KAVENEGAR_SUPPORT_TEMPLATE: z.string().min(1).default(defaultConfig.sms.supportTemplate),
  ZARINPAL_MERCHANT_ID: z.string().optional(),
  ZARINPAL_SANDBOX_MERCHANT_ID: z.string().min(1).default(defaultConfig.payment.sandboxMerchantId),
  ZARINPAL_API_BASE: z.string().url().default(defaultConfig.payment.apiBase),
  ZARINPAL_START_BASE: z.string().url().default(defaultConfig.payment.startBase),
  ZARINPAL_SANDBOX_API_BASE: z.string().url().default(defaultConfig.payment.sandboxApiBase),
  ZARINPAL_SANDBOX_START_BASE: z.string().url().default(defaultConfig.payment.sandboxStartBase),
  PAYMENT_RECONCILIATION_INTERVAL_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(defaultConfig.payment.reconciliationIntervalMs),
  PAYMENT_RECONCILIATION_MINIMUM_AGE_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(defaultConfig.payment.reconciliationMinimumAgeMs),
  PAYMENT_RECONCILIATION_RETRY_AFTER_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(defaultConfig.payment.reconciliationRetryAfterMs),
  PAYMENT_RECONCILIATION_BATCH_SIZE: z.coerce
    .number()
    .int()
    .positive()
    .default(defaultConfig.payment.reconciliationBatchSize),
  ZARINPAL_SANDBOX: z
    .enum(['true', 'false'])
    .default(booleanDefault(defaultConfig.payment.sandbox))
    .transform((value) => value === 'true'),
  // Opt-in switch for the fixed local-development OTP (`123456`) and for
  // echoing that code back in the API response. It defaults to off so any
  // environment that forgets to configure it issues real random codes over a
  // real SMS provider instead of silently accepting a well-known one.
  AUTH_DEV_OTP: z
    .enum(['true', 'false'])
    .default(booleanDefault(defaultConfig.auth.developmentOtp))
    .transform((value) => value === 'true'),
  // Number of reverse proxies in front of the API. Per-IP rate limiting reads
  // `request.ip`, which only reflects the real client once Express is told how
  // many X-Forwarded-For hops to trust. Left at 0 (the default) a proxied
  // deployment buckets every client together; set too high, clients can spoof
  // the header and evade the limiter entirely — so it must match the actual
  // deployment topology.
  TRUST_PROXY: z.coerce.number().int().min(0).default(defaultConfig.app.trustProxy),
});

export const envSchemaWithGuards = envSchema.superRefine((env, ctx) => {
  if (env.NODE_ENV === 'production' && env.AUTH_OTP_ALLOWLIST.length > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['AUTH_OTP_ALLOWLIST'],
      message: 'AUTH_OTP_ALLOWLIST is disabled in production',
    });
  }
  // A non-empty allowlist with no code would have to fall back to a constant
  // compiled into the source — the exact property that makes AUTH_DEV_OTP
  // unusable here. Refuse to start instead of inventing one.
  if (env.AUTH_OTP_ALLOWLIST.length > 0 && !env.AUTH_OTP_ALLOWLIST_CODE) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['AUTH_OTP_ALLOWLIST_CODE'],
      message: 'AUTH_OTP_ALLOWLIST_CODE is required whenever AUTH_OTP_ALLOWLIST is not empty',
    });
  }
  // Contradictory: AUTH_DEV_OTP already accepts a fixed code for every phone,
  // so an allowlist alongside it narrows nothing and only obscures which of the
  // two is actually in force.
  if (env.AUTH_OTP_ALLOWLIST.length > 0 && env.AUTH_DEV_OTP) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['AUTH_OTP_ALLOWLIST'],
      message: 'AUTH_OTP_ALLOWLIST must not be combined with AUTH_DEV_OTP, which already fixes the code for every phone',
    });
  }
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
      message:
        'ZARINPAL_MERCHANT_ID is required when NODE_ENV=production: without it the payment gateway accepts unverified development callbacks',
    });
  }
  if (env.NODE_ENV === 'production' && env.ZARINPAL_SANDBOX) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['ZARINPAL_SANDBOX'],
      message: 'ZARINPAL_SANDBOX must be disabled in production',
    });
  }
  if (env.NODE_ENV === 'production' && !env.KAVENEGAR_API_KEY) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['KAVENEGAR_API_KEY'],
      message:
        'KAVENEGAR_API_KEY is required when NODE_ENV=production: without it OTP and reminder SMS are only logged, never delivered',
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
