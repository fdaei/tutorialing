import { Injectable } from '@nestjs/common';
import { DocumentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { badRequest, forbidden, notFound } from '../../common/errors';

@Injectable()
export class VerificationService {
  constructor(private readonly db: PrismaService) {}

  async attach(userId: string, kind: string, fileId: string) {
    const normalizedKind = kind.trim().toLowerCase();
    if (!normalizedKind) throw badRequest('TEACHER_DOCUMENT_KIND_REQUIRED', 'نوع مدرک را انتخاب کنید.', 'Select the document type.');
    const teacher = await this.db.teacher.findUnique({ where: { userId } });
    if (!teacher) throw notFound('TEACHER_NOT_FOUND', 'ابتدا پروفایل مدرس را تکمیل کنید.', 'Complete the teacher profile first.');
    const file = await this.db.storedFile.findFirst({ where: { id: fileId, ownerId: userId, status: 'SAFE' } });
    if (!file) {
      throw badRequest(
        'TEACHER_DOCUMENT_FILE_INVALID',
        'فایل مدرک کامل یا ایمن نیست. فایل را دوباره بارگذاری کنید.',
        'The document upload is incomplete or unsafe. Upload the file again.',
        { fileId: { fa: 'فقط فایل بارگذاری‌شده و تأییدشده توسط سامانه قابل ثبت است.', en: 'Only a completed and verified upload can be attached.' } },
      );
    }
    return this.db.$transaction(async (tx) => {
      const item = await tx.verificationItem.create({
        data: { teacherId: teacher.id, kind: normalizedKind, fileId, status: 'SUBMITTED', submittedAt: new Date() },
        include: { file: true },
      });
      await tx.auditLog.create({ data: { actorId: userId, action: 'verification.document.submitted', entity: 'VerificationItem', entityId: item.id, after: { kind: normalizedKind, fileId } } });
      return item;
    });
  }

  async review(actorId: string, id: string, status: DocumentStatus, note?: string) {
    if (!['UNDER_REVIEW', 'APPROVED', 'REJECTED', 'NEEDS_REVISION'].includes(status)) {
      throw badRequest('DOCUMENT_REVIEW_STATUS_INVALID', 'وضعیت بررسی مدرک معتبر نیست.', 'The document review status is invalid.');
    }
    if (['REJECTED', 'NEEDS_REVISION'].includes(status) && !note?.trim()) {
      throw badRequest(
        'DOCUMENT_REVIEW_REASON_REQUIRED',
        'برای رد مدرک یا درخواست اصلاح، دلیل دقیق را بنویسید.',
        'Provide a clear reason when rejecting a document or requesting revision.',
        { note: { fa: 'مشکل مدرک و روش اصلاح آن را توضیح دهید.', en: 'Explain the document issue and how the teacher can correct it.' } },
      );
    }
    return this.db.$transaction(async (tx) => {
      const before = await tx.verificationItem.findUnique({ where: { id }, include: { teacher: true } });
      if (!before) throw notFound('VERIFICATION_ITEM_NOT_FOUND', 'مدرک پیدا نشد.', 'Verification document not found.');
      const item = await tx.verificationItem.update({
        where: { id },
        data: {
          status,
          reviewedById: actorId,
          reviewedAt: new Date(),
          note,
          rejectionReason: ['REJECTED', 'NEEDS_REVISION'].includes(status) ? note : null,
        },
      });
      await tx.auditLog.create({ data: { actorId, action: 'verification.item.reviewed', entity: 'VerificationItem', entityId: id, before: { status: before.status }, after: { status, note } } });
      await tx.notification.create({
        data: {
          userId: before.teacher.userId,
          type: 'TEACHER_DOCUMENT_REVIEWED',
          titleFa: 'وضعیت مدرک شما به‌روزرسانی شد',
          titleEn: 'Document status updated',
          bodyFa: status === 'APPROVED' ? 'مدرک شما تأیید شد.' : `وضعیت مدرک به ${status} تغییر کرد.${note ? ` توضیح: ${note}` : ''}`,
          bodyEn: status === 'APPROVED' ? 'Your document was approved.' : `The document status changed to ${status}.${note ? ` Note: ${note}` : ''}`,
          data: { verificationItemId: id, status, path: '/teacher-panel/documents' },
        },
      });
      return item;
    });
  }

  async resubmit(userId: string, id: string, fileId: string) {
    const item = await this.db.verificationItem.findUnique({ where: { id }, include: { teacher: true } });
    if (!item) throw notFound('VERIFICATION_ITEM_NOT_FOUND', 'مدرک پیدا نشد.', 'Verification document not found.');
    if (item.teacher.userId !== userId) throw forbidden('DOCUMENT_RESUBMIT_FORBIDDEN', 'این مدرک متعلق به حساب شما نیست.', 'This document does not belong to your account.');
    if (!['REJECTED', 'NEEDS_REVISION'].includes(item.status)) throw badRequest('DOCUMENT_NOT_RESUBMITTABLE', 'این مدرک در وضعیت فعلی نیاز به ارسال مجدد ندارد.', 'This document does not require resubmission in its current state.');
    const file = await this.db.storedFile.findFirst({ where: { id: fileId, ownerId: userId, status: 'SAFE' } });
    if (!file) throw badRequest('TEACHER_DOCUMENT_FILE_INVALID', 'فایل جدید کامل یا ایمن نیست.', 'The new file is incomplete or unsafe.');
    return this.db.$transaction(async (tx) => {
      const updated = await tx.verificationItem.update({
        where: { id },
        data: { fileId, status: 'SUBMITTED', submittedAt: new Date(), reviewedAt: null, reviewedById: null, rejectionReason: null, note: null },
      });
      await tx.auditLog.create({ data: { actorId: userId, action: 'verification.document.resubmitted', entity: 'VerificationItem', entityId: id, before: { fileId: item.fileId, status: item.status }, after: { fileId, status: 'SUBMITTED' } } });
      return updated;
    });
  }

  async introVideo(userId: string, fileId: string) {
    const file = await this.db.storedFile.findFirst({
      where: { id: fileId, ownerId: userId, status: 'SAFE', mimeType: { in: ['video/mp4', 'video/webm', 'video/quicktime'] } },
    });
    if (!file) throw badRequest('INTRO_VIDEO_INVALID', 'ویدیوی معرفی باید MP4، WebM یا MOV و با موفقیت بارگذاری شده باشد.', 'The intro video must be a successfully uploaded MP4, WebM, or MOV file.');
    return this.db.teacher.update({ where: { userId }, data: { introVideoKey: file.key } });
  }
}
