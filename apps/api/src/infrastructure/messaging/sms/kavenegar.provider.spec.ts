const configValue = {
  KAVENEGAR_API_KEY: 'secret-key',
  KAVENEGAR_API_BASE: 'https://sms.example.test',
};

jest.mock('../../../config', () => ({ config: () => configValue }));

import { KavenegarProvider } from './kavenegar.provider';

describe('KavenegarProvider', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('encodes lookup tokens and returns a provider-neutral result', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: true, json: jest.fn().mockResolvedValue({ return: { status: 200 } }) });
    const provider = new KavenegarProvider();

    const result = await provider.sendLookup({
      phone: '0912 000 0000',
      template: 'lesson reminder',
      tokens: ['2026-08-26', '10-30'],
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('receptor=0912+000+0000&token=2026-08-26&template=lesson+reminder&token2=10-30'),
      expect.objectContaining({ method: 'POST', signal: expect.any(AbortSignal) }),
    );
    expect(result).toEqual({ providerId: expect.stringMatching(/^kavenegar-/), response: { return: { status: 200 } } });
  });

  it('normalizes rejected and invalid provider responses', async () => {
    const provider = new KavenegarProvider();
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, json: jest.fn().mockResolvedValue({ return: { status: 400 } }) });
    await expect(
      provider.sendLookup({ phone: '09120000000', template: 'otp', tokens: ['123456'] }),
    ).rejects.toMatchObject({
      code: 'REJECTED',
    });

    global.fetch = jest.fn().mockResolvedValueOnce({ ok: true, json: jest.fn().mockRejectedValue(new SyntaxError()) });
    await expect(
      provider.sendLookup({ phone: '09120000000', template: 'otp', tokens: ['123456'] }),
    ).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
  });

  it('normalizes timeouts without exposing provider details to callers', async () => {
    global.fetch = jest.fn().mockRejectedValue(Object.assign(new Error('timed out'), { name: 'TimeoutError' }));
    const provider = new KavenegarProvider();
    await expect(
      provider.sendLookup({ phone: '09120000000', template: 'otp', tokens: ['123456'] }),
    ).rejects.toMatchObject({
      code: 'TIMEOUT',
    });
  });
});
