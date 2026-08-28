import { clearAuthSession, storeAccessToken } from './auth-session';
import { API_URL } from './config';

// Refresh tokens rotate and the API revokes the whole token family when it sees
// a token it has already replaced. A page that fires several requests at once
// gets several 401s at once, so refreshing per-request would send the same
// refresh token N times: the first rotates it and the rest look like replay,
// which signs the user out entirely. All of them share one in-flight refresh
// instead, then retry with whatever it produced.
let pendingRefresh: Promise<string | null> | null = null;

function accessTokenFrom(value: unknown): string | null {
  if (!value || typeof value !== 'object' || !('accessToken' in value)) return null;
  return typeof value.accessToken === 'string' ? value.accessToken : null;
}

export function refreshAccessToken(): Promise<string | null> {
  pendingRefresh ??= (async () => {
    try {
      const refreshed = await fetch(`${API_URL}/auth/refresh`, { method: 'POST', credentials: 'include' });
      if (!refreshed.ok) {
        clearAuthSession();
        return null;
      }
      const token = accessTokenFrom(await refreshed.json());
      if (!token) {
        clearAuthSession();
        return null;
      }
      storeAccessToken(token);
      return token;
    } catch {
      // A network failure is not proof the session is gone, but the cached token is
      // already known to be rejected, so drop it and let the caller surface the 401.
      clearAuthSession();
      return null;
    }
  })().finally(() => {
    pendingRefresh = null;
  });
  return pendingRefresh;
}
