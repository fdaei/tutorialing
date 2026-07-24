import { Injectable } from '@nestjs/common';
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import type { Readable } from 'stream';
import { PrismaService } from '../../prisma.service';
import { badRequest, notFound } from '../../common/errors';
import { config } from '../../config';

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
  private readonly cfg = config();
  private readonly s3 = new S3Client({
    region: 'us-east-1',
    endpoint: this.cfg.S3_ENDPOINT,
    forcePathStyle: true,
    credentials: {
      accessKeyId: this.cfg.S3_ACCESS_KEY,
      secretAccessKey: this.cfg.S3_SECRET_KEY,
    },
  });

  constructor(private readonly db: PrismaService) {}

  async createUpload(ownerId: string, data: { originalName: string; mimeType: string; size: number; checksum: string; purpose: string }) {
    if (!allowed.has(data.mimeType)) {
      throw badRequest(
        'FILE_TYPE_NOT_ALLOWED',
        'فرمت فایل مجاز نیست. برای مدارک PDF، JPG یا PNG و برای ویدئو MP4، WebM یا MOV انتخاب کنید.',
        'The file type is not allowed. Use PDF, JPG, or PNG for documents and MP4, WebM, or MOV for videos.',
        { mimeType: { fa: 'فرمت فایل انتخاب‌شده توسط سامانه پشتیبانی نمی‌شود.', en: 'The selected file format is not supported.' } },
      );
    }
    if (data.size <= 0 || data.size > 50 * 1024 * 1024) {
      throw badRequest(
        'FILE_SIZE_INVALID',
        'حجم فایل باید بیشتر از صفر و حداکثر ۵۰ مگابایت باشد.',
        'The file must be larger than zero and no more than 50 MB.',
        { size: { fa: 'فایلی با حجم حداکثر ۵۰ مگابایت انتخاب کنید.', en: 'Choose a file no larger than 50 MB.' } },
      );
    }
    if (!/^[a-f0-9]{64}$/i.test(data.checksum)) {
      throw badRequest('FILE_CHECKSUM_INVALID', 'اعتبارسنجی فایل ناموفق بود. فایل را دوباره انتخاب کنید.', 'File validation failed. Select the file again.');
    }
    const ext = data.originalName.split('.').pop()?.replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'bin';
    const key = `${ownerId}/${data.purpose}/${randomUUID()}.${ext}`;
    const file = await this.db.storedFile.create({ data: { ownerId, key, ...data, status: 'PENDING' } });
    const uploadUrl = await getSignedUrl(this.s3, new PutObjectCommand({
      Bucket: this.cfg.S3_BUCKET,
      Key: key,
      ContentType: data.mimeType,
      ContentLength: data.size,
      Metadata: { checksum: data.checksum },
    }), { expiresIn: 600 });
    return { fileId: file.id, uploadUrl, expiresIn: 600 };
  }

  async uploadContent(ownerId: string, id: string, checksum: string, body: Readable) {
    const file = await this.db.storedFile.findFirst({ where: { id, ownerId, status: 'PENDING' } });
    if (!file) throw notFound('UPLOAD_NOT_FOUND', 'آپلود پیدا نشد یا قبلاً تکمیل شده است.', 'The upload was not found or has already been completed.');
    if (!checksum || checksum !== file.checksum) {
      throw badRequest('UPLOAD_CHECKSUM_MISMATCH', 'محتوای فایل با فایل انتخاب‌شده مطابقت ندارد.', 'The uploaded content does not match the selected file.');
    }
    await this.s3.send(new PutObjectCommand({
      Bucket: this.cfg.S3_BUCKET,
      Key: file.key,
      Body: body,
      ContentType: file.mimeType,
      ContentLength: file.size,
      Metadata: { checksum: file.checksum },
    }));
    return { ok: true };
  }

  async complete(ownerId: string, id: string) {
    const file = await this.db.storedFile.findFirst({ where: { id, ownerId } });
    if (!file) throw notFound('UPLOAD_NOT_FOUND', 'فایل بارگذاری‌شده پیدا نشد.', 'The uploaded file was not found.');
    let head;
    try {
      head = await this.s3.send(new HeadObjectCommand({ Bucket: this.cfg.S3_BUCKET, Key: file.key }));
    } catch {
      throw badRequest(
        'UPLOAD_CONTENT_MISSING',
        'ارسال فایل به فضای ذخیره‌سازی کامل نشد. اتصال را بررسی و دوباره تلاش کنید.',
        'The file was not fully uploaded to storage. Check the connection and try again.',
      );
    }
    if (head.ContentLength !== file.size || head.ContentType !== file.mimeType || head.Metadata?.checksum !== file.checksum) {
      await this.db.storedFile.update({ where: { id }, data: { status: 'QUARANTINED' } });
      throw badRequest(
        'UPLOAD_VALIDATION_FAILED',
        'فایل دریافت شد اما اندازه، نوع یا محتوای آن معتبر نیست. فایل را دوباره بارگذاری کنید.',
        'The file was received, but its size, type, or content is invalid. Upload it again.',
      );
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
          ...(reviewer ? [
            { verificationItems: { some: {} } },
            { testAnswers: { some: { attempt: { status: 'UNDER_REVIEW' as const } } } },
          ] : []),
        ],
      },
    });
    if (!file) throw notFound('FILE_NOT_FOUND', 'فایل پیدا نشد یا اجازه مشاهده آن را ندارید.', 'The file was not found or you cannot access it.');
    return {
      url: await getSignedUrl(this.s3, new GetObjectCommand({ Bucket: this.cfg.S3_BUCKET, Key: file.key }), { expiresIn: 300 }),
      expiresIn: 300,
    };
  }
}
