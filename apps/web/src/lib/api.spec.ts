import { api, ApiError } from './api';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001/api';

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response;
}

describe('api access-token refresh', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem('access_token', 'stale-token');
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  const refreshCalls = () => fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/auth/refresh'));

  it('refreshes once for concurrent 401s and retries each request with the new token', async () => {
    // Rotating refresh tokens means a second refresh with the same cookie looks
    // like replay to the API and revokes the whole family, so N parallel 401s
    // must still produce exactly one refresh call.
    let refreshResolve!: (value: Response) => void;
    const refreshPending = new Promise<Response>((resolve) => {
      refreshResolve = resolve;
    });

    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (String(url).endsWith('/auth/refresh')) return refreshPending;
      const auth = (init?.headers as Record<string, string> | undefined)?.authorization;
      if (auth === 'Bearer fresh-token') return Promise.resolve(jsonResponse(200, { ok: true }));
      return Promise.resolve(jsonResponse(401, { message: 'expired' }));
    });

    const inFlight = Promise.all([api('/users/me'), api('/bookings'), api('/teachers')]);
    await Promise.resolve();
    refreshResolve(jsonResponse(200, { accessToken: 'fresh-token' }));

    await expect(inFlight).resolves.toEqual([{ ok: true }, { ok: true }, { ok: true }]);
    expect(refreshCalls()).toHaveLength(1);
    expect(sessionStorage.getItem('access_token')).toBe('fresh-token');
  });

  it('clears the stored token and surfaces the 401 when the refresh is rejected', async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        String(url).endsWith('/auth/refresh')
          ? jsonResponse(401, { message: 'reuse detected' })
          : jsonResponse(401, { code: 'UNAUTHORIZED', message: 'expired' }),
      ),
    );

    await expect(api('/users/me')).rejects.toBeInstanceOf(ApiError);
    expect(sessionStorage.getItem('access_token')).toBeNull();
    expect(refreshCalls()).toHaveLength(1);
  });

  it('starts a new refresh for a later 401 rather than reusing the settled one', async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (String(url).endsWith('/auth/refresh'))
        return Promise.resolve(jsonResponse(200, { accessToken: 'fresh-token' }));
      const auth = (init?.headers as Record<string, string> | undefined)?.authorization;
      return Promise.resolve(auth === 'Bearer fresh-token' ? jsonResponse(200, { ok: true }) : jsonResponse(401, {}));
    });

    await api('/users/me');
    sessionStorage.setItem('access_token', 'stale-again');
    await api('/users/me');

    expect(refreshCalls()).toHaveLength(2);
  });

  it('does not attempt a refresh when the request succeeds', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));
    await expect(api(`${''}/users/me`)).resolves.toEqual({ ok: true });
    expect(refreshCalls()).toHaveLength(0);
    expect(fetchMock).toHaveBeenCalledWith(`${API}/users/me`, expect.anything());
  });
});
