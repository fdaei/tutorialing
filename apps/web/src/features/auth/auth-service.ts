'use client';

import { api, ApiError, publicApi } from '@/shared/services/api';
import type { PanelIdentity } from '@/lib/panel-access';

/**
 * The single seam between the password-style auth screens and the backend.
 *
 * Keeping every network call here means the page components stay pure UI and
 * never learn an endpoint path.
 */

/**
 * The server generates and validates a six-digit code
 * (`@Matches(/^\d{6}$/)` in VerifyOtpDto, `randomInt(100000, 1000000)` in
 * AuthService). Changing the code length is a backend change first; this
 * constant then follows it.
 */
export const OTP_LENGTH = 6;

const CHALLENGE_KEY = 'password-recovery-challenge';

/** Thrown when a screen exists but the endpoint behind it does not. */
export class AuthUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthUnavailableError';
  }
}

export type RecoveryChallenge = {
  challengeId: string;
  phone: string;
  resendIn: number;
  /** Set once the OTP has been accepted, which is what unlocks /reset-password. */
  verified?: boolean;
  /** Only ever populated when the API runs with AUTH_DEV_OTP=true. */
  developmentCode?: string;
};

export type ParsedIdentity = { kind: 'phone'; phone: string } | { kind: 'email'; email: string } | { kind: 'invalid' };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Normalizes a mobile number to the E.164 form the API's `IsInternationalPhone`
 * validator expects. Accepts an already-international `+…` number, and treats a
 * bare local number as Iranian (`0912…`, `912…`, `0098912…`, `98912…`).
 */
export function normalizePhone(value: string): string | null {
  const trimmed = value.replace(/[\s()-]/g, '');
  if (/^\+\d{8,15}$/.test(trimmed)) return trimmed;
  const digits = trimmed.replace(/\D/g, '').replace(/^0098/, '').replace(/^98/, '').replace(/^0/, '');
  return digits.length === 10 ? `+98${digits}` : null;
}

/** Classifies the shared "email or mobile" field so callers can branch on it. */
export function parseIdentity(value: string): ParsedIdentity {
  const trimmed = value.trim();
  if (EMAIL_PATTERN.test(trimmed)) return { kind: 'email', email: trimmed.toLowerCase() };
  const phone = normalizePhone(trimmed);
  return phone ? { kind: 'phone', phone } : { kind: 'invalid' };
}

/** Formats a stored E.164 number for display without flipping digits under RTL. */
export function displayPhone(phone: string) {
  return phone.startsWith('+98') ? `0${phone.slice(3)}` : phone;
}

export function readRecovery(): RecoveryChallenge | null {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(sessionStorage.getItem(CHALLENGE_KEY) ?? 'null') as RecoveryChallenge | null;
  } catch {
    return null;
  }
}

export function saveRecovery(value: RecoveryChallenge) {
  sessionStorage.setItem(CHALLENGE_KEY, JSON.stringify(value));
}

export function clearRecovery() {
  sessionStorage.removeItem(CHALLENGE_KEY);
}

type OtpRequestResponse = { challengeId: string; resendIn: number; developmentCode?: string };
type SessionResponse = { accessToken: string; user?: PanelIdentity };

async function requestOtp(path: '/auth/otp/request' | '/auth/otp/resend', phone: string) {
  const response = await publicApi<OtpRequestResponse>(path, {
    method: 'POST',
    body: JSON.stringify({ phone }),
  });
  const challenge: RecoveryChallenge = {
    challengeId: response.challengeId,
    phone,
    resendIn: response.resendIn,
    developmentCode: response.developmentCode,
  };
  saveRecovery(challenge);
  return challenge;
}

/**
 * Step 1 of recovery. Real call: POST /auth/otp/request.
 *
 * Email recovery is rejected up front rather than sent to an endpoint that only
 * accepts phone numbers, so the user gets an actionable message instead of a 400.
 */
export async function sendRecoveryCode(identity: string): Promise<RecoveryChallenge> {
  const parsed = parseIdentity(identity);
  if (parsed.kind === 'email')
    throw new AuthUnavailableError('بازیابی با ایمیل هنوز فعال نیست؛ لطفاً شماره موبایل خود را وارد کنید.');
  if (parsed.kind === 'invalid') throw new AuthUnavailableError('شماره موبایل وارد شده معتبر نیست.');
  return requestOtp('/auth/otp/request', parsed.phone);
}

/** Real call: POST /auth/otp/resend, reusing the number from the stored challenge. */
export async function resendRecoveryCode(): Promise<RecoveryChallenge> {
  const current = readRecovery();
  if (!current) throw new AuthUnavailableError('درخواست بازیابی پیدا نشد. دوباره کد دریافت کنید.');
  return requestOtp('/auth/otp/resend', current.phone);
}

/**
 * Step 2 of recovery. Real call: POST /auth/otp/verify.
 *
 * A verified OTP is a full sign-in on this backend, so the returned access token
 * is stored exactly as the /auth page stores it and the user is genuinely
 * authenticated from here on.
 */
export async function verifyRecoveryCode(code: string): Promise<SessionResponse> {
  const challenge = readRecovery();
  if (!challenge) throw new AuthUnavailableError('درخواست بازیابی پیدا نشد. دوباره کد دریافت کنید.');
  const session = await publicApi<SessionResponse>('/auth/otp/verify', {
    method: 'POST',
    credentials: 'include',
    body: JSON.stringify({ phone: challenge.phone, challengeId: challenge.challengeId, code }),
  });
  sessionStorage.setItem('access_token', session.accessToken);
  saveRecovery({ ...challenge, verified: true });
  return session;
}

/** Real call: POST /auth/google, with a credential from Google Identity Services. */
export async function googleAuth(credential: string): Promise<SessionResponse> {
  const session = await publicApi<SessionResponse>('/auth/google', {
    method: 'POST',
    credentials: 'include',
    body: JSON.stringify({ credential }),
  });
  sessionStorage.setItem('access_token', session.accessToken);
  return session;
}

export async function loginWithPassword(identity: string, password: string): Promise<SessionResponse> {
  const session = await publicApi<SessionResponse>('/auth/password/login', {
    method: 'POST', credentials: 'include', body: JSON.stringify({ identity, password }),
  });
  sessionStorage.setItem('access_token', session.accessToken);
  return session;
}

export async function registerWithPassword(input: {
  name: string;
  identity: string;
  password: string;
}): Promise<SessionResponse> {
  const session = await publicApi<SessionResponse>('/auth/password/register', {
    method: 'POST', credentials: 'include', body: JSON.stringify(input),
  });
  sessionStorage.setItem('access_token', session.accessToken);
  return session;
}

export async function saveNewPassword(password: string): Promise<void> {
  await api('/auth/password/set', { method: 'POST', body: JSON.stringify({ password }) });
}

/** Normalizes anything thrown by this module into a Persian message for the UI. */
export function authMessage(error: unknown, fallback = 'خطایی رخ داد. دوباره تلاش کنید') {
  if (error instanceof AuthUnavailableError) return error.message;
  if (error instanceof ApiError) return error.message;
  return error instanceof Error && error.message ? error.message : fallback;
}
