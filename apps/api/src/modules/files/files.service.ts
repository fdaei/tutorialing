import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Readable } from 'stream';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { badRequest, notFound, assertDomain, requireValue } from '../../common';
import { filesConfig } from '../../config/files.config';
import { OBJECT_STORAGE, ObjectStorage } from './object-storage.port';

const allowed = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
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
  constructor(private readonly db: PrismaService, @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage) {}

  async createUpload(
    ownerId: string,
    data: { originalName: string; mimeType: string; size: number; checksum: string; purpose: string },
  ) {
    assertDomain(allowed.has(data.mimeType), () => badRequest('FILE_TYPE_NOT_ALLOWED'));
    assertDomain(data.size > 0 && data.size <= this.cfg.maxUploadBytes, () => badRequest('FILE_SIZE_INVALID'));
    assertDomain(/^[a-f0-9]{64}$/i.test(data.checksum), () => badRequest('FILE_CHECKSUM_INVALID'));
    const ext =
      data.originalName
        .split('.')
        .pop()
        ?.replace(/[^a-z0-9]/gi, '')
        .slice(0, 8) || 'bin';
    const key = `${ownerId}/${data.purpose}/${randomUUID()}.${ext}`;
    const file = await this.db.storedFile.create({ data: { ownerId, key, ...data, status: 'PENDING' } });
    const uploadUrl = await this.storage.createUploadUrl({ key, contentType: data.mimeType, contentLength: data.size, checksum: data.checksum });
    return { fileId: file.id, uploadUrl, expiresIn: this.cfg.uploadUrlTtlSeconds };
  }

  async uploadContent(ownerId: string, id: string, checksum: string, body: Readable) {
    const file = requireValue(await this.db.storedFile.findFirst({ where: { id, ownerId, status: 'PENDING' } }), () =>
      notFound('UPLOAD_NOT_FOUND'),
    );
    assertDomain(checksum && checksum === file.checksum, () => badRequest('UPLOAD_CHECKSUM_MISMATCH'));
    await this.storage.putObject({ key: file.key, body, contentType: file.mimeType, contentLength: file.size, checksum: file.checksum });
    return { ok: true };
  }

  async complete(ownerId: string, id: string) {
    const file = requireValue(await this.db.storedFile.findFirst({ where: { id, ownerId } }), () =>
      notFound('UPLOAD_NOT_FOUND'),
    );
    const head = await this.storage.headObject(file.key);
    if (!head) throw badRequest('UPLOAD_CONTENT_MISSING');
    if (
      head.contentLength !== file.size ||
      head.contentType !== file.mimeType ||
      head.checksum !== file.checksum
    ) {
      await this.db.storedFile.update({ where: { id }, data: { status: 'QUARANTINED' } });
      throw badRequest('UPLOAD_VALIDATION_FAILED');
    }
    return this.db.storedFile.update({ where: { id }, data: { status: 'SAFE' } });
  }

  async download(requesterId: string, roles: string[], id: string) {
    const reviewer = roles.some((role) => ['ADMIN', 'STAFF', 'EXAMINER'].includes(role));
    const supportStaff = roles.some((role) => ['ADMIN', 'STAFF', 'SUPPORT'].includes(role));
    const supportAttachment = await this.db.ticketReply.findFirst({
      where: {
        attachmentId: id,
        ...(supportStaff ? {} : { ticket: { userId: requesterId } }),
      },
      select: { id: true },
    });
    const file = requireValue(
      await this.db.storedFile.findFirst({
        where: {
          id,
          status: 'SAFE',
          OR: [
            { ownerId: requesterId },
            ...(supportAttachment ? [{ id }] : []),
            ...(reviewer
              ? [
                  { verificationItems: { some: {} } },
                  { testAnswers: { some: { attempt: { status: 'UNDER_REVIEW' as const } } } },
                ]
              : []),
          ],
        },
      }),
      () => notFound('FILE_NOT_FOUND'),
    );
    return {
      url: await this.storage.createDownloadUrl(file.key),
      expiresIn: this.cfg.downloadUrlTtlSeconds,
    };
  }

  async ownedSafeImage(ownerId: string, id: string) {
    const file = requireValue(
      await this.db.storedFile.findFirst({
        where: { id, ownerId, status: 'SAFE', mimeType: { in: ['image/jpeg', 'image/png', 'image/webp'] } },
        select: { key: true, size: true },
      }),
      () => notFound('FILE_NOT_FOUND'),
    );
    assertDomain(file.size <= 5 * 1024 * 1024, () => badRequest('FILE_SIZE_INVALID'));
    return file;
  }

  createDownloadUrl(key: string) {
    return this.storage.createDownloadUrl(key);
  }
}
