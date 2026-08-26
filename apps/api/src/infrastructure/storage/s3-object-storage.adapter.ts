import { Injectable } from '@nestjs/common';
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { filesConfig } from '../../config/files.config';
import { ObjectStorage } from '../../modules/files/object-storage.port';
import type { Readable } from 'stream';

@Injectable()
export class S3ObjectStorageAdapter implements ObjectStorage {
  private readonly cfg = filesConfig();
  private readonly client = new S3Client({
    region: this.cfg.region,
    endpoint: this.cfg.endpoint,
    forcePathStyle: this.cfg.forcePathStyle,
    credentials: { accessKeyId: this.cfg.accessKey, secretAccessKey: this.cfg.secretKey },
  });

  createUploadUrl(input: { key: string; contentType: string; contentLength: number; checksum: string }) {
    return getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.cfg.bucket,
        Key: input.key,
        ContentType: input.contentType,
        ContentLength: input.contentLength,
        Metadata: { checksum: input.checksum },
      }),
      { expiresIn: this.cfg.uploadUrlTtlSeconds },
    );
  }

  async putObject(input: { key: string; body: Readable; contentType: string; contentLength: number; checksum: string }) {
    await this.client.send(new PutObjectCommand({
      Bucket: this.cfg.bucket,
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
      ContentLength: input.contentLength,
      Metadata: { checksum: input.checksum },
    }));
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
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.cfg.bucket, Key: key }), {
      expiresIn: this.cfg.downloadUrlTtlSeconds,
    });
  }
}
