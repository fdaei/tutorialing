import { readAccessToken } from './auth-session';
import { API_URL } from './config';
import { createHeaders } from './request';
import { parseResponse } from './response';
import { refreshAccessToken } from './refresh-token';

export async function publicApi<T>(path: string, init?: RequestInit): Promise<T> {
  return parseResponse(await fetch(`${API_URL}${path}`, { ...init, headers: createHeaders(init), cache: init?.cache ?? 'no-store' }));
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = typeof window !== 'undefined' ? readAccessToken() : null;
  let r = await fetch(`${API_URL}${path}`, { ...init, credentials: 'include', headers: createHeaders(init, token) });
  // A 401 can be the expected answer to an anonymous identity probe (the
  // header and auth pages both make one). Without a cached access token there
  // is no browser session to renew, so calling refresh only produces a noisy
  // REFRESH_TOKEN_REQUIRED response after logout or on a first visit.
  if (
    r.status === 401 &&
    token &&
    path !== '/auth/refresh' &&
    typeof window !== 'undefined' &&
    !init?.signal?.aborted
  ) {
    const refreshedToken = await refreshAccessToken();
    if (refreshedToken)
      r = await fetch(`${API_URL}${path}`, { ...init, credentials: 'include', headers: createHeaders(init, refreshedToken) });
  }
  return parseResponse(r);
}
