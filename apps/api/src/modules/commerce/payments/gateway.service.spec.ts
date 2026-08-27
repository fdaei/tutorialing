import { config } from '../../../config';
import { GatewayService } from './gateway.service';

jest.mock('../../../config', () => ({ config: jest.fn() }));

const mockedConfig = jest.mocked(config);

describe('GatewayService Zarinpal mode selection', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('uses the Zarinpal v4 sandbox request and StartPay endpoints', async () => {
    mockedConfig.mockReturnValue({
      ZARINPAL_SANDBOX: true,
      ZARINPAL_MERCHANT_ID: undefined,
      ZARINPAL_SANDBOX_MERCHANT_ID: 'XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX',
      ZARINPAL_SANDBOX_API_BASE: 'https://sandbox.zarinpal.com',
      ZARINPAL_SANDBOX_START_BASE: 'https://sandbox.zarinpal.com',
      WEB_URL: 'http://localhost:3000',
      PROVIDER_TIMEOUT_MS: 10_000,
    } as ReturnType<typeof config>);
    global.fetch = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: { code: 100, authority: 'S00000000000000000000000000000test1' },
          errors: [],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const result = await new GatewayService().request(100_000, 'Sandbox test', 'http://localhost/callback');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://sandbox.zarinpal.com/pg/v4/payment/request.json',
      expect.objectContaining({ method: 'POST', body: expect.stringContaining('"amount":1000000') }),
    );
    expect(result.url).toBe('https://sandbox.zarinpal.com/pg/StartPay/S00000000000000000000000000000test1');
  });

  it('accepts only Zarinpal verification codes 100 and 101', async () => {
    mockedConfig.mockReturnValue({
      ZARINPAL_SANDBOX: true,
      ZARINPAL_MERCHANT_ID: undefined,
      ZARINPAL_SANDBOX_MERCHANT_ID: 'XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX',
      ZARINPAL_SANDBOX_API_BASE: 'https://sandbox.zarinpal.com',
      ZARINPAL_SANDBOX_START_BASE: 'https://sandbox.zarinpal.com',
      WEB_URL: 'http://localhost:3000',
      PROVIDER_TIMEOUT_MS: 10_000,
    } as ReturnType<typeof config>);
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { code: 100, ref_id: 12345 }, errors: [] }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { code: -51, message: 'Failed' }, errors: [] }), { status: 200 }),
      );
    const gateway = new GatewayService();

    await expect(gateway.verify('S00000000000000000000000000000ok', 100_000)).resolves.toEqual({
      ok: true,
      reference: '12345',
    });
    await expect(gateway.verify('S00000000000000000000000000000bad', 100_000)).resolves.toEqual({ ok: false });
    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      'https://sandbox.zarinpal.com/pg/v4/payment/verify.json',
      expect.objectContaining({ body: expect.stringContaining('"amount":1000000') }),
    );
  });
});

/**
 * FIN-302. Neither Zarinpal call carried a deadline. A gateway that accepts the
 * connection and then never answers held the request — and the worker serving
 * it — open indefinitely. On `verify` that is the worse of the two: the caller
 * is a payment callback and the money has already moved.
 */
describe('GatewayService provider deadline (FIN-302)', () => {
  const originalFetch = global.fetch;
  const TIMEOUT_MS = 50;

  /** Settles only when its abort signal fires — a gateway that never answers. */
  const hangingFetch = () =>
    jest.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () =>
            reject(Object.assign(new Error('aborted due to timeout'), { name: 'TimeoutError' })),
          );
        }),
    );

  beforeEach(() => {
    mockedConfig.mockReturnValue({
      ZARINPAL_SANDBOX: true,
      ZARINPAL_MERCHANT_ID: undefined,
      ZARINPAL_SANDBOX_MERCHANT_ID: 'XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX',
      ZARINPAL_SANDBOX_API_BASE: 'https://sandbox.zarinpal.com',
      ZARINPAL_SANDBOX_START_BASE: 'https://sandbox.zarinpal.com',
      WEB_URL: 'http://localhost:3000',
      PROVIDER_TIMEOUT_MS: TIMEOUT_MS,
    } as ReturnType<typeof config>);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it.each(['request', 'verify'] as const)('gives up on a %s that never answers', async (method) => {
    global.fetch = hangingFetch() as never;
    const gateway = new GatewayService();
    const call = {
      request: () => gateway.request(100_000, 'Test', 'http://localhost/callback'),
      verify: () => gateway.verify('S00000000000000000000000000000hang', 100_000),
    }[method];

    const startedAt = Date.now();
    // A stable 502, not a hang and not a raw undici error escaping as a 500.
    await expect(call()).rejects.toMatchObject({
      status: 502,
      message: `Zarinpal did not respond within ${TIMEOUT_MS}ms`,
    });
    // Well inside the default 5s jest timeout: proof it ended at the deadline
    // rather than being killed by the test runner.
    expect(Date.now() - startedAt).toBeLessThan(2_000);
  });

  it('passes the abort signal on every outbound call', async () => {
    global.fetch = hangingFetch() as never;
    await expect(new GatewayService().verify('S00000000000000000000000000000hang', 100_000)).rejects.toBeDefined();
    expect(global.fetch).toHaveBeenCalledWith(
      'https://sandbox.zarinpal.com/pg/v4/payment/verify.json',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('does not retry a timed-out capture', async () => {
    // Replaying `verify` blind re-attempts a capture whose outcome is unknown.
    // Recovery is ReconciliationService's job, deliberately and on its own
    // schedule — not a blind retry on the callback's hot path.
    global.fetch = hangingFetch() as never;
    await expect(new GatewayService().verify('S00000000000000000000000000000hang', 100_000)).rejects.toBeDefined();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('normalises a transport failure to the same gateway error', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('fetch failed')) as never;
    await expect(new GatewayService().request(100_000, 'Test', 'http://localhost/callback')).rejects.toMatchObject({
      status: 502,
      message: 'Zarinpal request failed',
    });
  });
});
