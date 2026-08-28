import { api } from '@/shared/services/api';
import { UploadError, isAbortError } from './upload-errors';
import type { CreateUploadRequest, UploadResponse } from './types';

function isUploadResponse(value: unknown): value is UploadResponse {
  if (!value || typeof value !== 'object') return false;
  return 'fileId' in value && typeof value.fileId === 'string' && 'uploadUrl' in value && typeof value.uploadUrl === 'string';
}

export async function createUpload(request: CreateUploadRequest, signal?: AbortSignal): Promise<UploadResponse> {
  try {
    const response = await api<unknown>('/files/uploads', {
      method: 'POST',
      body: JSON.stringify(request),
      signal,
    });
    if (!isUploadResponse(response)) throw new UploadError('create');
    return response;
  } catch (error) {
    if (error instanceof UploadError) throw error;
    if (isAbortError(error) || signal?.aborted) throw new UploadError('cancelled', error);
    throw new UploadError('create', error);
  }
}

/** Returns false only when the existing server fallback transport should be used. */
export async function uploadToSignedUrl(
  uploadUrl: string,
  body: Blob,
  mimeType: string,
  checksum: string,
  signal?: AbortSignal,
): Promise<boolean> {
  try {
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      body,
      headers: { 'content-type': mimeType, 'x-amz-meta-checksum': checksum },
      signal,
    });
    return response.ok;
  } catch (error) {
    if (isAbortError(error) || signal?.aborted) throw new UploadError('cancelled', error);
    return false;
  }
}

export async function uploadThroughFallback(
  fileId: string,
  body: Blob,
  mimeType: string,
  checksum: string,
  signal?: AbortSignal,
): Promise<void> {
  try {
    await api(`/files/uploads/${fileId}/content`, {
      method: 'POST',
      headers: { 'content-type': mimeType, 'x-content-checksum': checksum },
      body,
      signal,
    });
  } catch (error) {
    if (isAbortError(error) || signal?.aborted) throw new UploadError('cancelled', error);
    throw new UploadError('fallback', error);
  }
}

export async function finalizeUpload(fileId: string, signal?: AbortSignal): Promise<void> {
  try {
    await api(`/files/${fileId}/complete`, { method: 'POST', signal });
  } catch (error) {
    if (isAbortError(error) || signal?.aborted) throw new UploadError('cancelled', error);
    throw new UploadError('finalize', error);
  }
}
