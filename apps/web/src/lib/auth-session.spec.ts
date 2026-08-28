import { AUTH_SESSION_EVENT, clearAuthSession, storeAccessToken } from './auth-session';

describe('auth session synchronization', () => {
  beforeEach(() => sessionStorage.clear());

  it('announces login after storing the access token', () => {
    const listener = jest.fn();
    window.addEventListener(AUTH_SESSION_EVENT, listener);
    storeAccessToken('access-token');
    expect(sessionStorage.getItem('access_token')).toBe('access-token');
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ detail: 'authenticated' }));
    window.removeEventListener(AUTH_SESSION_EVENT, listener);
  });

  it('clears the token and announces logout without requiring a reload', () => {
    sessionStorage.setItem('access_token', 'access-token');
    const listener = jest.fn();
    window.addEventListener(AUTH_SESSION_EVENT, listener);
    clearAuthSession();
    expect(sessionStorage.getItem('access_token')).toBeNull();
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ detail: 'anonymous' }));
    window.removeEventListener(AUTH_SESSION_EVENT, listener);
  });
});
