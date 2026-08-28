import { upload } from '@/shared/services/upload';

const extensions: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/x-m4a': 'm4a',
};

export async function uploadSpeakingAudio(blob: Blob): Promise<string> {
  const mimeType = blob.type.split(';')[0] || 'audio/webm';
  const extension = extensions[mimeType] ?? 'webm';
  const result = await upload({
    body: blob,
    originalName: `speaking-answer.${extension}`,
    mimeType,
    purpose: 'speaking-answer',
  });
  return result.fileId;
}
