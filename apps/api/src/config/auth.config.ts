import type { SignOptions } from 'jsonwebtoken';
import { config } from './index';
import { runtimeEnvironment } from '../common/types';

export function authConfig() {
  const env = config();
  const runtime = runtimeEnvironment(env.NODE_ENV);
  return {
    accessSecret: env.JWT_ACCESS_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET,
    accessTokenTtl: env.JWT_ACCESS_TTL as SignOptions['expiresIn'],
    accessTokenTtlSeconds: env.JWT_ACCESS_TTL_SECONDS,
    refreshTokenTtlSeconds: env.JWT_REFRESH_TTL_SECONDS,
    otpTtlSeconds: env.AUTH_OTP_TTL_SECONDS,
    otpResendSeconds: env.AUTH_OTP_RESEND_SECONDS,
    otpRecentRequestWindowSeconds: env.AUTH_OTP_RECENT_REQUEST_WINDOW_SECONDS,
    otpHourlyWindowSeconds: env.AUTH_OTP_HOURLY_WINDOW_SECONDS,
    otpHourlyLimit: env.AUTH_OTP_HOURLY_LIMIT,
    otpAttemptLimit: env.AUTH_OTP_ATTEMPT_LIMIT,
    developmentOtp: env.AUTH_DEV_OTP,
    otpAllowlist: env.AUTH_OTP_ALLOWLIST,
    otpAllowlistCode: env.AUTH_OTP_ALLOWLIST_CODE,
    googleClientId: env.GOOGLE_CLIENT_ID,
    providerTimeoutMs: env.PROVIDER_TIMEOUT_MS,
    secureCookie: runtime.isProduction,
  };
}
