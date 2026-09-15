// Set before importing the adapter: `filesConfig()` parses the environment at
// class-property-initialisation time.
process.env.DATABASE_URL ??= 'postgresql://u:p@localhost:15432/db?schema=public';
process.env.JWT_ACCESS_SECRET ??= 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET ??= 'b'.repeat(32);
process.env.S3_ACCESS_KEY ??= 'minio';
process.env.S3_SECRET_KEY ??= 'secret';
process.env.S3_BUCKET ??= 'lingospeak';

import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

const { S3ObjectStorageAdapter } = require('./s3-object-storage.adapter') as typeof import('./s3-object-storage.adapter');

// sha256("hello"), in the hex the API carries and the base64 x-amz-checksum-sha256 takes.
const CHECKSUM = '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824';
const CHECKSUM_BASE64 = 'LPJNul+wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCQ=';

// `send` is overloaded per command type, which types a plain spy's mocks as `never`.
const spyOnSend = () => jest.spyOn(S3Client.prototype, 'send') as unknown as jest.Mock;

describe('S3ObjectStorageAdapter', () => {
  afterEach(() => jest.restoreAllMocks());

  describe('createUploadUrl', () => {
    async function signedUpload() {
      const url = await new S3ObjectStorageAdapter().createUploadUrl({
        key: 'owner/avatar/file.png',
        contentType: 'image/png',
        contentLength: 5,
        checksum: CHECKSUM,
      });
      return new URL(url);
    }

    // The browser sends exactly content-type, x-amz-meta-checksum and x-amz-checksum-sha256
    // (web: shared/services/upload/upload-client.ts). Storage refuses any x-amz-* header that
    // isn't signed, which is how every direct upload used to fail and fall back to the API.
    it('signs every header the browser sends as a header', async () => {
      const url = await signedUpload();
      expect(url.searchParams.get('X-Amz-SignedHeaders')).toBe(
        'content-length;content-type;host;x-amz-checksum-sha256;x-amz-meta-checksum',
      );
    });

    it('keeps metadata and checksums out of the query string', async () => {
      const url = await signedUpload();
      expect([...url.searchParams.keys()].filter((key) => /checksum|x-amz-meta/i.test(key))).toEqual([]);
    });

    // At presign time there is no body, so the SDK's default CRC32 would be the empty body's
    // (AAAAAA==) and S3 would reject every real upload against it.
    it('does not let the SDK add its empty-body CRC32', async () => {
      const url = await signedUpload();
      expect(url.search).not.toMatch(/crc32|x-amz-sdk-checksum-algorithm/i);
    });
  });

  describe('putObject', () => {
    const input = () => ({
      key: 'owner/avatar/file.png',
      body: Readable.from([Buffer.from('hello')]),
      contentType: 'image/png',
      contentLength: 5,
      checksum: CHECKSUM,
    });

    it('asks storage to verify the declared SHA-256, like the direct upload', async () => {
      const send = spyOnSend().mockResolvedValue({});
      await new S3ObjectStorageAdapter().putObject(input());
      const command = send.mock.calls[0]?.[0] as PutObjectCommand;
      expect(command.input).toMatchObject({ Metadata: { checksum: CHECKSUM }, ChecksumSHA256: CHECKSUM_BASE64 });
    });

    it.each(['BadDigest', 'XAmzContentChecksumMismatch'])('maps a %s rejection to UPLOAD_CHECKSUM_MISMATCH', async (name) => {
      spyOnSend().mockRejectedValue(Object.assign(new Error('digest mismatch'), { name }));
      await expect(new S3ObjectStorageAdapter().putObject(input())).rejects.toMatchObject({
        response: { code: 'UPLOAD_CHECKSUM_MISMATCH' },
      });
    });

    it('rethrows other storage failures untouched', async () => {
      const failure = Object.assign(new Error('unreachable'), { name: 'TimeoutError' });
      spyOnSend().mockRejectedValue(failure);
      await expect(new S3ObjectStorageAdapter().putObject(input())).rejects.toBe(failure);
    });
  });
});
