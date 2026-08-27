import { config } from './index';

export function paymentConfig() {
  const env = config();
  const sandbox = env.ZARINPAL_SANDBOX;

  return {
    merchantId: env.ZARINPAL_MERCHANT_ID || (sandbox ? env.ZARINPAL_SANDBOX_MERCHANT_ID : ''),
    apiBase: sandbox ? env.ZARINPAL_SANDBOX_API_BASE : env.ZARINPAL_API_BASE,
    startBase: sandbox ? env.ZARINPAL_SANDBOX_START_BASE : env.ZARINPAL_START_BASE,
    webUrl: env.WEB_URL,
    providerTimeoutMs: env.PROVIDER_TIMEOUT_MS,
    reconciliationIntervalMs: env.PAYMENT_RECONCILIATION_INTERVAL_MS,
    reconciliationMinimumAgeMs: env.PAYMENT_RECONCILIATION_MINIMUM_AGE_MS,
    reconciliationRetryAfterMs: env.PAYMENT_RECONCILIATION_RETRY_AFTER_MS,
    reconciliationBatchSize: env.PAYMENT_RECONCILIATION_BATCH_SIZE,
  };
}
