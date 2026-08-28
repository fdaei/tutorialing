import { translate } from '@/lib/i18n';
import { upload } from '@/shared/services/upload';

export const SUPPORT_ATTACHMENT_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
export const SUPPORT_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

export async function uploadSupportAttachment(file: File, fa: boolean): Promise<string> {
  if (!SUPPORT_ATTACHMENT_TYPES.includes(file.type)) {
    throw new Error(translate(fa, 'supportmyTicketManagerOnlyPDFJPGAndPNGFilesAreAllowed'));
  }
  if (file.size > SUPPORT_ATTACHMENT_MAX_BYTES) {
    throw new Error(translate(fa, 'supportmyTicketManagerTheFileMustNotExceed10MB'));
  }
  const result = await upload({
    body: file,
    originalName: file.name,
    mimeType: file.type,
    purpose: 'support-attachment',
  });
  return result.fileId;
}
