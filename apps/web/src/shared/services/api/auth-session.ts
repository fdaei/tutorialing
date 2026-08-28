export const ACCESS_TOKEN_KEY = 'access_token';
export const AUTH_SESSION_EVENT = 'lingospeak:auth-session-changed';

export type AuthSessionState = 'authenticated' | 'anonymous';

function announce(state: AuthSessionState) {
  window.dispatchEvent(new CustomEvent<AuthSessionState>(AUTH_SESSION_EVENT, { detail: state }));
}

export function storeAccessToken(token: string) {
  sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
  announce('authenticated');
}

export function clearAuthSession() {
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  announce('anonymous');
}

export function onAuthSessionChange(listener: (state: AuthSessionState) => void) {
  const handle = (event: Event) => {
    if (event instanceof CustomEvent && (event.detail === 'authenticated' || event.detail === 'anonymous')) {
      listener(event.detail);
    }
  };
  window.addEventListener(AUTH_SESSION_EVENT, handle);
  return () => window.removeEventListener(AUTH_SESSION_EVENT, handle);
}

export function readAccessToken() {
  return sessionStorage.getItem(ACCESS_TOKEN_KEY);
}
