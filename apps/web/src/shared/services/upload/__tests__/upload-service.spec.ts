import { webcrypto } from 'node:crypto';
import { api } from '@/shared/services/api';
import { calculateSha256 } from '../checksum';
import { UploadError } from '../upload-errors';
import { upload } from '../upload-service';

jest.mock('@/shared/services/api', () => ({ api: jest.fn() }));

const mockedApi = jest.mocked(api);
const signedUrl = 'https://storage.invalid/private-signature';

function source() {
  return {
    body: new Blob(['hello'], { type: 'text/plain' }),
    originalName: 'hello.txt',
    mimeType: 'text/plain',
    purpose: 'test-upload',
  };
}

describe('shared upload workflow', () => {
  beforeAll(() => {
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: webcrypto });
    Blob.prototype.arrayBuffer = function arrayBuffer() {
      return new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result instanceof ArrayBuffer ? reader.result : new ArrayBuffer(0));
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(this);
      });
    };
  });

  beforeEach(() => {
    mockedApi.mockReset();
    mockedApi.mockResolvedValueOnce({ fileId: 'file-1', uploadUrl: signedUrl });
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
  });

  it('produces a stable SHA-256 checksum compatible with the existing implementation', async () => {
    await expect(calculateSha256(new Blob(['hello']))).resolves.toBe(
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
    );
  });

  it('uses the signed upload as the primary path and finalizes it', async () => {
    await expect(upload(source())).resolves.toEqual({ fileId: 'file-1' });
    expect(global.fetch).toHaveBeenCalledWith(
      signedUrl,
      expect.objectContaining({ method: 'PUT', headers: expect.objectContaining({ 'x-amz-meta-checksum': expect.any(String) }) }),
    );
    expect(mockedApi).toHaveBeenCalledTimes(2);
    expect(mockedApi).toHaveBeenLastCalledWith('/files/file-1/complete', expect.objectContaining({ method: 'POST' }));
  });

  it('maps signed-upload preparation failures and rejects malformed API responses', async () => {
    mockedApi.mockReset();
    mockedApi.mockRejectedValueOnce(new Error('private API response'));
    await expect(upload(source())).rejects.toMatchObject({ stage: 'create' });

    mockedApi.mockReset();
    mockedApi.mockResolvedValueOnce({ fileId: 'file-1' });
    await expect(upload(source())).rejects.toMatchObject({ stage: 'create' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it.each([
    ['network failure', () => Promise.reject(new TypeError('network unavailable'))],
    ['non-ok storage response', () => Promise.resolve({ ok: false })],
  ])('uses fallback after an allowed signed-upload %s', async (_label, result) => {
    global.fetch = jest.fn().mockImplementation(result);
    await upload(source());
    expect(mockedApi).toHaveBeenNthCalledWith(
      2,
      '/files/uploads/file-1/content',
      expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ 'x-content-checksum': expect.any(String) }) }),
    );
    expect(mockedApi).toHaveBeenNthCalledWith(3, '/files/file-1/complete', expect.objectContaining({ method: 'POST' }));
  });

  it('does not fallback or finalize when the signed upload is aborted', async () => {
    global.fetch = jest.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError'));
    await expect(upload(source())).rejects.toMatchObject({ stage: 'cancelled' });
    expect(mockedApi).toHaveBeenCalledTimes(1);
  });

  it('does not finalize after fallback failure', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false });
    mockedApi.mockRejectedValueOnce(new Error('private fallback response'));
    await expect(upload(source())).rejects.toMatchObject({ stage: 'fallback' });
    expect(mockedApi).toHaveBeenCalledTimes(2);
  });

  it('returns a finalize error after a successful upload when completion fails', async () => {
    mockedApi.mockRejectedValueOnce(new Error('private completion response'));
    await expect(upload(source())).rejects.toMatchObject({ stage: 'finalize' });
  });

  it('does not expose signed URLs, tokens, or internal responses in error messages', async () => {
    mockedApi.mockReset();
    mockedApi.mockRejectedValue(new Error(`${signedUrl}?token=secret internal response`));
    const error = await upload(source()).catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(UploadError);
    if (!(error instanceof UploadError)) throw new Error('Expected UploadError');
    expect(error.message).not.toMatch(/signature|token|internal response/i);
  });

  it('passes AbortSignal through every transport step', async () => {
    const controller = new AbortController();
    await upload(source(), { signal: controller.signal });
    expect(mockedApi).toHaveBeenNthCalledWith(1, '/files/uploads', expect.objectContaining({ signal: controller.signal }));
    expect(global.fetch).toHaveBeenCalledWith(signedUrl, expect.objectContaining({ signal: controller.signal }));
    expect(mockedApi).toHaveBeenLastCalledWith(
      '/files/file-1/complete',
      expect.objectContaining({ signal: controller.signal }),
    );
  });
});
