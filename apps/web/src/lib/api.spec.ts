import { api, ApiError, publicApi } from './api';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001/api';

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function authorization(init?: RequestInit) {
  return new Headers(init?.headers).get('authorization');
}

describe('api access-token refresh', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem('access_token', 'stale-token');
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  const refreshCalls = () => fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/auth/refresh'));

  it('refreshes once for concurrent 401s and retries each request with the new token', async () => {
    // Rotating refresh tokens means a second refresh with the same cookie looks
    // like replay to the API and revokes the whole family, so N parallel 401s
    // must still produce exactly one refresh call.
    let refreshResolve: ((value: ReturnType<typeof jsonResponse>) => void) | undefined;
    const refreshPending = new Promise<ReturnType<typeof jsonResponse>>((resolve) => {
      refreshResolve = resolve;
    });

    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (String(url).endsWith('/auth/refresh')) return refreshPending;
      const auth = authorization(init);
      if (auth === 'Bearer fresh-token') return Promise.resolve(jsonResponse(200, { ok: true }));
      return Promise.resolve(jsonResponse(401, { message: 'expired' }));
    });

    const inFlight = Promise.all([api('/users/me'), api('/bookings'), api('/teachers')]);
    await Promise.resolve();
    if (!refreshResolve) throw new Error('Expected pending refresh');
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
      const auth = authorization(init);
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

  it('does not attempt a refresh for an anonymous 401 without an access token', async () => {
    sessionStorage.removeItem('access_token');
    fetchMock.mockResolvedValue(jsonResponse(401, { code: 'UNAUTHORIZED', message: 'Authentication required' }));

    await expect(api('/users/me')).rejects.toMatchObject({ status: 401 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(refreshCalls()).toHaveLength(0);
  });

  it('retries the original request only once and never refreshes recursively', async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        String(url).endsWith('/auth/refresh')
          ? jsonResponse(200, { accessToken: 'fresh-token' })
          : jsonResponse(401, { message: 'still unauthorized' }),
      ),
    );
    await expect(api('/users/me')).rejects.toMatchObject({ status: 401 });
    expect(refreshCalls()).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does not refresh or retry an aborted request', async () => {
    fetchMock.mockRejectedValueOnce(new DOMException('cancelled', 'AbortError'));
    const controller = new AbortController();
    controller.abort();
    await expect(api('/users/me', { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(refreshCalls()).toHaveLength(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not recursively refresh when the refresh endpoint itself returns 401', async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, { message: 'refresh rejected' }));
    await expect(api('/auth/refresh', { method: 'POST' })).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(refreshCalls()).toHaveLength(1);
  });

  it('does not refresh or retry when the signal is cancelled after a 401 response', async () => {
    const controller = new AbortController();
    fetchMock.mockImplementationOnce(() => {
      controller.abort();
      return Promise.resolve(jsonResponse(401, { message: 'expired' }));
    });
    await expect(api('/users/me', { signal: controller.signal })).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(refreshCalls()).toHaveLength(0);
  });

  it('clears the session when refresh returns a malformed success response', async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        String(url).endsWith('/auth/refresh')
          ? jsonResponse(200, { accessToken: null })
          : jsonResponse(401, { message: 'expired' }),
      ),
    );
    await expect(api('/users/me')).rejects.toMatchObject({ status: 401 });
    expect(sessionStorage.getItem('access_token')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('api transport characterization', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    sessionStorage.clear();
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  it('returns JSON and preserves query strings, body, headers, and request options', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: 'user-1' }));
    const body = JSON.stringify({ name: 'Sara' });
    await expect(
      publicApi('/users?active=true', {
        method: 'POST',
        body,
        headers: { 'x-request-source': 'characterization' },
        cache: 'force-cache',
      }),
    ).resolves.toEqual({ id: 'user-1' });
    expect(fetchMock).toHaveBeenCalledWith(`${API}/users?active=true`, {
      method: 'POST',
      body,
      headers: { 'content-type': 'application/json', 'x-request-source': 'characterization' },
      cache: 'force-cache',
    });
  });

  it('returns null for a 204 that carries no body by definition', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 204, json: async () => Promise.reject(new SyntaxError('empty')) });
    await expect(publicApi('/empty')).resolves.toBeNull();
  });

  it('rejects a 200 whose body is not JSON instead of laundering null into the caller', async () => {
    // A proxy placeholder or an HTML error page served with 200 used to resolve
    // as null typed as T, so the failure surfaced as "Cannot read properties of
    // null" inside whichever component first touched the payload.
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => Promise.reject(new SyntaxError('<html>')) });
    await expect(publicApi('/teachers')).rejects.toMatchObject({
      name: 'ApiError',
      status: 200,
      details: { code: 'INVALID_RESPONSE_BODY' },
    });
  });

  it('preserves an explicit JSON null body for endpoints that return one', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, null));
    await expect(publicApi('/support/pages/missing')).resolves.toBeNull();
  });

  it('maps HTTP errors and field errors to the observable ApiError contract', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(422, {
        code: 'VALIDATION_ERROR',
        fieldErrors: { email: 'VALIDATION_IS_EMAIL' },
        requestId: 'request-1',
      }),
    );
    const error = await publicApi('/users', { method: 'POST' }).catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 422,
      details: { fieldErrors: { email: 'ایمیل معتبر وارد کنید.' }, requestId: 'request-1' },
    });
  });

  it('preserves network failures without exposing or transforming their internals', async () => {
    const failure = new TypeError('network unavailable');
    fetchMock.mockRejectedValue(failure);
    await expect(publicApi('/users')).rejects.toBe(failure);
  });

  it('adds credentials and the stored token only to authenticated requests', async () => {
    sessionStorage.setItem('access_token', 'secret-access-token');
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));
    await api('/users/me', { headers: { 'x-client': 'web' } });
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init).toEqual(
      expect.objectContaining({
        credentials: 'include',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer secret-access-token',
          'x-client': 'web',
        },
      }),
    );
  });
});
