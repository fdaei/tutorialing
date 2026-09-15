import { Injectable } from '@nestjs/common';
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { badRequest } from '../../common/errors';
import { filesConfig } from '../../config/files.config';
import { ObjectStorage } from '../../modules/files/object-storage.port';
import type { Readable } from 'stream';

// What storage answers when a body doesn't hash to the x-amz-checksum-* it was
// sent with: AWS S3 says BadDigest, MinIO XAmzContentChecksumMismatch.
const CHECKSUM_MISMATCH_ERRORS = new Set(['BadDigest', 'XAmzContentChecksumMismatch']);

/** The API and object metadata carry the SHA-256 as hex; `x-amz-checksum-sha256` takes it base64. */
function sha256Base64(hex: string) {
  return Buffer.from(hex, 'hex').toString('base64');
}

@Injectable()
export class S3ObjectStorageAdapter implements ObjectStorage {
  private readonly cfg = filesConfig();
  private readonly client = new S3Client({
    region: this.cfg.region,
    endpoint: this.cfg.endpoint,
    forcePathStyle: this.cfg.forcePathStyle,
    credentials: { accessKeyId: this.cfg.accessKey, secretAccessKey: this.cfg.secretKey },
  });

  private readonly publicClient = new S3Client({
    region: this.cfg.region,
    endpoint: this.cfg.publicEndpoint,
    forcePathStyle: this.cfg.forcePathStyle,
    credentials: { accessKeyId: this.cfg.accessKey, secretAccessKey: this.cfg.secretKey },
  });

  /**
   * The browser PUTs to this URL with exactly `content-type`, `x-amz-meta-checksum`
   * and `x-amz-checksum-sha256` (web: shared/services/upload/upload-client.ts).
   * Left to its defaults the presigner moves `x-amz-*` values into the query
   * string and signs only `host` and `content-length`, so those same values
   * arriving as headers are unsigned and storage refuses the PUT ("There were
   * headers present in the request which were not signed"). Signing them as
   * headers binds the type, metadata and digest to the signature instead.
   *
   * Passing the real ChecksumSHA256 also stops the SDK adding its default CRC32,
   * which at presign time can only hash the empty body (`AAAAAA==`) and would
   * make S3 reject every real upload; storage now refuses any body that doesn't
   * hash to the digest the client declared.
   */
  createUploadUrl(input: { key: string; contentType: string; contentLength: number; checksum: string }) {
    return getSignedUrl(
      this.publicClient,
      new PutObjectCommand({
        Bucket: this.cfg.bucket,
        Key: input.key,
        ContentType: input.contentType,
        ContentLength: input.contentLength,
        Metadata: { checksum: input.checksum },
        ChecksumSHA256: sha256Base64(input.checksum),
      }),
      {
        expiresIn: this.cfg.uploadUrlTtlSeconds,
        signableHeaders: new Set(['content-type']),
        unhoistableHeaders: new Set(['x-amz-meta-checksum', 'x-amz-checksum-sha256']),
      },
    );
  }

  async putObject(input: { key: string; body: Readable; contentType: string; contentLength: number; checksum: string }) {
    try {
      await this.client.send(new PutObjectCommand({
        Bucket: this.cfg.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
        ContentLength: input.contentLength,
        Metadata: { checksum: input.checksum },
        // Same storage-side digest check as the direct upload, so the fallback isn't the weaker path.
        ChecksumSHA256: sha256Base64(input.checksum),
      }));
    } catch (error) {
      if (error instanceof Error && CHECKSUM_MISMATCH_ERRORS.has(error.name)) throw badRequest('UPLOAD_CHECKSUM_MISMATCH');
      throw error;
    }
  }

  async headObject(key: string) {
    try {
      const head = await this.client.send(new HeadObjectCommand({ Bucket: this.cfg.bucket, Key: key }));
      return { contentLength: head.ContentLength, contentType: head.ContentType, checksum: head.Metadata?.checksum };
    } catch {
      return null;
    }
  }

  createDownloadUrl(key: string) {
    return getSignedUrl(this.publicClient, new GetObjectCommand({ Bucket: this.cfg.bucket, Key: key }), {
      expiresIn: this.cfg.downloadUrlTtlSeconds,
    });
  }

  async deleteObject(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.cfg.bucket, Key: key }));
  }
}
