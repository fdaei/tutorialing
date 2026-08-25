import { config } from './index';

export function healthConfig() {
  const env = config();
  return { checkTimeoutMs: env.HEALTH_CHECK_TIMEOUT_MS, serviceName: env.SERVICE_NAME };
}
