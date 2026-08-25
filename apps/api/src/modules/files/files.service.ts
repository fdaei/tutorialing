import { Injectable } from '@nestjs/common';
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import type { Readable } from 'stream';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { badRequest, notFound } from '../../common';
import { filesConfig } from '../../config/files.config';

const allowed = new Set([
  'image/jpeg',
  'image/png',
  'application/pdf',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'audio/webm',
  'audio/mpeg',
  'audio/mp4',
  'audio/ogg',
  'audio/wav',
  'audio/x-m4a',
]);

@Injectable()
export class FilesService {
  private readonly cfg = filesConfig();
  private readonly s3 = new S3Client({
    region: this.cfg.region,
    endpoint: this.cfg.endpoint,
    forcePathStyle: this.cfg.forcePathStyle,
    credentials: {
      accessKeyId: this.cfg.accessKey,
      secretAccessKey: this.cfg.secretKey,
    },
  });

  constructor(private readonly db: PrismaService) {}

  async createUpload(
    ownerId: string,
    data: { originalName: string; mimeType: string; size: number; checksum: string; purpose: string },
  ) {
    if (!allowed.has(data.mimeType)) {
      throw badRequest('FILE_TYPE_NOT_ALLOWED');
    }
    if (data.size <= 0 || data.size > this.cfg.maxUploadBytes) {
      throw badRequest('FILE_SIZE_INVALID');
    }
    if (!/^[a-f0-9]{64}$/i.test(data.checksum)) {
      throw badRequest('FILE_CHECKSUM_INVALID');
    }
    const ext =
      data.originalName
        .split('.')
        .pop()
        ?.replace(/[^a-z0-9]/gi, '')
        .slice(0, 8) || 'bin';
    const key = `${ownerId}/${data.purpose}/${randomUUID()}.${ext}`;
    const file = await this.db.storedFile.create({ data: { ownerId, key, ...data, status: 'PENDING' } });
    const uploadUrl = await getSignedUrl(
      this.s3,
      new PutObjectCommand({
        Bucket: this.cfg.bucket,
        Key: key,
        ContentType: data.mimeType,
        ContentLength: data.size,
        Metadata: { checksum: data.checksum },
      }),
      { expiresIn: this.cfg.uploadUrlTtlSeconds },
    );
    return { fileId: file.id, uploadUrl, expiresIn: this.cfg.uploadUrlTtlSeconds };
  }

  async uploadContent(ownerId: string, id: string, checksum: string, body: Readable) {
    const file = await this.db.storedFile.findFirst({ where: { id, ownerId, status: 'PENDING' } });
    if (!file) throw notFound('UPLOAD_NOT_FOUND');
    if (!checksum || checksum !== file.checksum) {
      throw badRequest('UPLOAD_CHECKSUM_MISMATCH');
    }
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.cfg.bucket,
        Key: file.key,
        Body: body,
        ContentType: file.mimeType,
        ContentLength: file.size,
        Metadata: { checksum: file.checksum },
      }),
    );
    return { ok: true };
  }

  async complete(ownerId: string, id: string) {
    const file = await this.db.storedFile.findFirst({ where: { id, ownerId } });
    if (!file) throw notFound('UPLOAD_NOT_FOUND');
    let head;
    try {
      head = await this.s3.send(new HeadObjectCommand({ Bucket: this.cfg.bucket, Key: file.key }));
    } catch {
      throw badRequest('UPLOAD_CONTENT_MISSING');
    }
    if (
      head.ContentLength !== file.size ||
      head.ContentType !== file.mimeType ||
      head.Metadata?.checksum !== file.checksum
    ) {
      await this.db.storedFile.update({ where: { id }, data: { status: 'QUARANTINED' } });
      throw badRequest('UPLOAD_VALIDATION_FAILED');
    }
    return this.db.storedFile.update({ where: { id }, data: { status: 'SAFE' } });
  }

  async download(requesterId: string, roles: string[], id: string) {
    const reviewer = roles.some((role) => ['ADMIN', 'STAFF', 'EXAMINER'].includes(role));
    const file = await this.db.storedFile.findFirst({
      where: {
        id,
        status: 'SAFE',
        OR: [
          { ownerId: requesterId },
          ...(reviewer
            ? [
                { verificationItems: { some: {} } },
                { testAnswers: { some: { attempt: { status: 'UNDER_REVIEW' as const } } } },
              ]
            : []),
        ],
      },
    });
    if (!file) throw notFound('FILE_NOT_FOUND');
    return {
      url: await getSignedUrl(this.s3, new GetObjectCommand({ Bucket: this.cfg.bucket, Key: file.key }), {
        expiresIn: this.cfg.downloadUrlTtlSeconds,
      }),
      expiresIn: this.cfg.downloadUrlTtlSeconds,
    };
  }
}
