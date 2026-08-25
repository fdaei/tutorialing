import { Injectable } from '@nestjs/common';
import { DocumentStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { badRequest, forbidden, notFound } from '../../common';

@Injectable()
export class VerificationService {
  constructor(private readonly db: PrismaService) {}

  async attach(userId: string, kind: string, fileId: string) {
    const normalizedKind = kind.trim().toLowerCase();
    if (!normalizedKind) throw badRequest('TEACHER_DOCUMENT_KIND_REQUIRED');
    const teacher = await this.db.teacher.findUnique({ where: { userId } });
    if (!teacher) throw notFound('TEACHER_NOT_FOUND');
    const file = await this.db.storedFile.findFirst({ where: { id: fileId, ownerId: userId, status: 'SAFE' } });
    if (!file) {
      throw badRequest('TEACHER_DOCUMENT_FILE_INVALID');
    }
    return this.db.$transaction(async (tx) => {
      const item = await tx.verificationItem.create({
        data: { teacherId: teacher.id, kind: normalizedKind, fileId, status: 'SUBMITTED', submittedAt: new Date() },
        include: { file: true },
      });
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'verification.document.submitted',
          entity: 'VerificationItem',
          entityId: item.id,
          after: { kind: normalizedKind, fileId },
        },
      });
      return item;
    });
  }

  async review(actorId: string, id: string, status: DocumentStatus, note?: string) {
    if (!['UNDER_REVIEW', 'APPROVED', 'REJECTED', 'NEEDS_REVISION'].includes(status)) {
      throw badRequest('DOCUMENT_REVIEW_STATUS_INVALID');
    }
    if (['REJECTED', 'NEEDS_REVISION'].includes(status) && !note?.trim()) {
      throw badRequest('DOCUMENT_REVIEW_REASON_REQUIRED');
    }
    return this.db.$transaction(async (tx) => {
      const before = await tx.verificationItem.findUnique({ where: { id }, include: { teacher: true } });
      if (!before) throw notFound('VERIFICATION_ITEM_NOT_FOUND');
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
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'verification.item.reviewed',
          entity: 'VerificationItem',
          entityId: id,
          before: { status: before.status },
          after: { status, note },
        },
      });
      await tx.notification.create({
        data: {
          userId: before.teacher.userId,
          type: 'TEACHER_DOCUMENT_REVIEWED',
          titleFa: 'وضعیت مدرک شما به‌روزرسانی شد',
          titleEn: 'Document status updated',
          bodyFa:
            status === 'APPROVED'
              ? 'مدرک شما تأیید شد.'
              : `وضعیت مدرک به ${status} تغییر کرد.${note ? ` توضیح: ${note}` : ''}`,
          bodyEn:
            status === 'APPROVED'
              ? 'Your document was approved.'
              : `The document status changed to ${status}.${note ? ` Note: ${note}` : ''}`,
          data: { verificationItemId: id, status, path: '/teacher-panel/documents' },
        },
      });
      return item;
    });
  }

  async resubmit(userId: string, id: string, fileId: string) {
    const item = await this.db.verificationItem.findUnique({ where: { id }, include: { teacher: true } });
    if (!item) throw notFound('VERIFICATION_ITEM_NOT_FOUND');
    if (item.teacher.userId !== userId) throw forbidden('DOCUMENT_RESUBMIT_FORBIDDEN');
    if (!['REJECTED', 'NEEDS_REVISION'].includes(item.status)) throw badRequest('DOCUMENT_NOT_RESUBMITTABLE');
    const file = await this.db.storedFile.findFirst({ where: { id: fileId, ownerId: userId, status: 'SAFE' } });
    if (!file) throw badRequest('TEACHER_DOCUMENT_FILE_INVALID');
    return this.db.$transaction(async (tx) => {
      const updated = await tx.verificationItem.update({
        where: { id },
        data: {
          fileId,
          status: 'SUBMITTED',
          submittedAt: new Date(),
          reviewedAt: null,
          reviewedById: null,
          rejectionReason: null,
          note: null,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'verification.document.resubmitted',
          entity: 'VerificationItem',
          entityId: id,
          before: { fileId: item.fileId, status: item.status },
          after: { fileId, status: 'SUBMITTED' },
        },
      });
      return updated;
    });
  }

  async introVideo(userId: string, fileId: string) {
    const file = await this.db.storedFile.findFirst({
      where: {
        id: fileId,
        ownerId: userId,
        status: 'SAFE',
        mimeType: { in: ['video/mp4', 'video/webm', 'video/quicktime'] },
      },
    });
    if (!file) throw badRequest('INTRO_VIDEO_INVALID');
    return this.db.teacher.update({ where: { userId }, data: { introVideoKey: file.key } });
  }
}
