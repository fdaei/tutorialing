// Defaults live in one place. Environment variables always take precedence;
// these values are only used when the matching variable is absent.
export const defaultConfig = {
  app: {
    nodeEnv: 'development',
    port: '4001',
    apiUrl: 'http://localhost:4001',
    webUrl: 'http://localhost:3000',
    trustProxy: 0,
  },
  redis: {
    url: 'redis://localhost:6379',
  },
  auth: {
    developmentOtp: false,
    accessTokenTtl: '15m',
    accessTokenTtlSeconds: 900,
    refreshTokenTtlSeconds: 2_592_000,
    otpTtlSeconds: 120,
    otpResendSeconds: 60,
    otpRecentRequestWindowSeconds: 600,
    otpHourlyWindowSeconds: 3_600,
    otpHourlyLimit: 10,
    otpAttemptLimit: 5,
  },
  storage: {
    endpoint: 'http://localhost:9000',
    region: 'us-east-1',
    forcePathStyle: true,
    maxUploadBytes: 52_428_800,
    uploadUrlTtlSeconds: 600,
    downloadUrlTtlSeconds: 300,
  },
  providers: {
    // Deadline for every outbound call to a third party (Google, Zarinpal,
    // Kavenegar). Without one, a provider that accepts the connection and then
    // never answers holds an API worker open for as long as it likes.
    timeoutMs: 10_000,
  },
  health: {
    checkTimeoutMs: 2_000,
    serviceName: 'lingospeak-api',
  },
  dashboard: {
    reconciliationIntervalMs: 600_000,
  },
  logging: {
    level: 'info',
    pretty: false,
    http: true,
    healthRequests: false,
  },
  sms: {
    apiBase: 'https://api.kavenegar.com',
    otpTemplate: 'lingospeak-otp',
    reminderTemplate: 'lingospeak-reminder',
    supportTemplate: 'lingospeak-ticket',
  },
  payment: {
    sandbox: false,
    sandboxMerchantId: 'XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX',
    apiBase: 'https://payment.zarinpal.com',
    startBase: 'https://payment.zarinpal.com',
    sandboxApiBase: 'https://sandbox.zarinpal.com',
    sandboxStartBase: 'https://sandbox.zarinpal.com',
    reconciliationIntervalMs: 60_000,
    reconciliationMinimumAgeMs: 120_000,
    reconciliationRetryAfterMs: 600_000,
    reconciliationBatchSize: 100,
  },
} as const;
