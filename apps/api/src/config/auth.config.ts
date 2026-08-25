import type { SignOptions } from 'jsonwebtoken';
import { config } from './index';
import { runtimeEnvironment } from '../common/utils';

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
    secureCookie: runtime.isProduction,
  };
}
