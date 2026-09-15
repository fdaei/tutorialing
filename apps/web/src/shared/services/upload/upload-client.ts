import { api } from '@/shared/services/api';
import { sha256HexToBase64 } from './checksum';
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

/**
 * Returns false only when storage couldn't be reached (network/CORS failure or a
 * 5xx from the storage edge), which is what the server fallback transport is for.
 * A 4xx means storage refused this exact request (expired URL, signature or
 * checksum mismatch); re-sending the bytes through the API would only hide that,
 * as it once hid every direct upload failing on unsigned headers.
 */
export async function uploadToSignedUrl(
  uploadUrl: string,
  body: Blob,
  mimeType: string,
  checksum: string,
  signal?: AbortSignal,
): Promise<boolean> {
  let response: Response;
  try {
    response = await fetch(uploadUrl, {
      method: 'PUT',
      body,
      // Exactly the headers the API signs into the URL (S3ObjectStorageAdapter.createUploadUrl);
      // one added, dropped or changed here makes storage reject the PUT.
      headers: {
        'content-type': mimeType,
        'x-amz-meta-checksum': checksum,
        'x-amz-checksum-sha256': sha256HexToBase64(checksum),
      },
      signal,
    });
  } catch (error) {
    if (isAbortError(error) || signal?.aborted) throw new UploadError('cancelled', error);
    return false;
  }
  if (response.ok) return true;
  if (response.status < 500) throw new UploadError('storage');
  return false;
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
