import { calculateSha256 } from './checksum';
import { createUpload, finalizeUpload, uploadThroughFallback, uploadToSignedUrl } from './upload-client';
import { UploadError, assertNotAborted } from './upload-errors';
import type { UploadOptions, UploadResult, UploadSource } from './types';

export async function upload(source: UploadSource, options: UploadOptions = {}): Promise<UploadResult> {
  const { signal } = options;
  assertNotAborted(signal);
  let checksum: string;
  try {
    checksum = await calculateSha256(source.body);
  } catch (error) {
    throw new UploadError('checksum', error);
  }
  assertNotAborted(signal);

  const request = {
    originalName: source.originalName,
    mimeType: source.mimeType,
    size: source.body.size,
    checksum,
    purpose: source.purpose,
  };
  const created = await createUpload(request, signal);
  const uploadedDirectly = await uploadToSignedUrl(
    created.uploadUrl,
    source.body,
    source.mimeType,
    checksum,
    signal,
  );
  if (!uploadedDirectly) {
    await uploadThroughFallback(created.fileId, source.body, source.mimeType, checksum, signal);
  }
  await finalizeUpload(created.fileId, signal);
  return { fileId: created.fileId };
}
