// Shared helpers for the LingoSpeak load/correctness scripts.
// Assumes the API is running locally with AUTH_DEV_OTP=true (fixed code 123456)
// and ZARINPAL_SANDBOX=true with no merchant id (dev-fallback gateway, see
// apps/api/src/modules/commerce/gateway.service.ts).
import { loadConfig } from '../config.mjs';

export const BASE = loadConfig.apiUrl;

export async function api(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { 'content-type': 'application/json', ...(opts.headers ?? {}) },
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* empty body */
  }
  return { status: res.status, headers: res.headers, body };
}

export async function loginWithOtp(phone) {
  const req = await api('/auth/otp/request', { method: 'POST', body: JSON.stringify({ phone }) });
  if (req.status >= 400) throw new Error(`otp/request failed for ${phone}: ${req.status} ${JSON.stringify(req.body)}`);
  const { challengeId } = req.body;
  const verify = await api('/auth/otp/verify', {
    method: 'POST',
    body: JSON.stringify({ challengeId, phone, code: '123456' }),
  });
  if (verify.status >= 400)
    throw new Error(`otp/verify failed for ${phone}: ${verify.status} ${JSON.stringify(verify.body)}`);
  return verify.body; // { accessToken, expiresIn, user }
}

export function authed(token) {
  return (path, opts = {}) =>
    api(path, { ...opts, headers: { authorization: `Bearer ${token}`, ...(opts.headers ?? {}) } });
}

export function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`);
}

export const SEED = {
  teacherSlug: 'sara-dadkhah',
  studentA: '09121111111',
  studentB: '09121111112',
};
