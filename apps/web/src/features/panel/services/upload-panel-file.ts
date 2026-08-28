import { translate } from '@/lib/i18n';
import { upload } from '@/shared/services/upload';

const PANEL_UPLOAD_TYPES = ['image/jpeg', 'image/png', 'application/pdf', 'video/mp4', 'video/webm', 'video/quicktime'];
const PANEL_UPLOAD_MAX_BYTES = 50 * 1024 * 1024;

export async function uploadPanelFile(file: File, purpose: string, fa: boolean): Promise<string> {
  if (!PANEL_UPLOAD_TYPES.includes(file.type)) {
    throw new Error(translate(fa, 'legacyUnsupportedFileFormatUsePDFJPGOrPNG'));
  }
  if (file.size > PANEL_UPLOAD_MAX_BYTES) {
    throw new Error(translate(fa, 'legacyTheFileMustNotBeLargerThan50'));
  }
  const result = await upload({
    body: file,
    originalName: file.name,
    mimeType: file.type,
    purpose,
  });
  return result.fileId;
}
