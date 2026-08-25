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
