import { ApiError, apiMessage } from '@/shared/services/api';

export type UploadErrorStage = 'checksum' | 'create' | 'storage' | 'fallback' | 'finalize' | 'cancelled';

const SAFE_MESSAGES: Record<UploadErrorStage, string> = {
  checksum: 'The upload checksum could not be calculated.',
  create: 'The upload could not be prepared.',
  storage: 'The file could not be uploaded to storage.',
  fallback: 'The file could not be uploaded through the fallback transport.',
  finalize: 'The uploaded file could not be finalized.',
  cancelled: 'The upload was cancelled.',
};

export class UploadError extends Error {
  constructor(
    public readonly stage: UploadErrorStage,
    public readonly cause?: unknown,
  ) {
    super(SAFE_MESSAGES[stage]);
    this.name = 'UploadError';
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

export function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new UploadError('cancelled', signal.reason);
}

/**
 * Display text for a failed upload, given the caller's already-localized fallback.
 *
 * The API client localizes `ApiError` messages, and before the upload workflow was
 * extracted those messages reached the UI directly, so an `ApiError` behind an
 * `UploadError` is unwrapped to keep that text. Every other cause collapses to the
 * caller's fallback, so signed URLs, tokens and raw transport text never surface.
 */
export function uploadErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof UploadError) return error.cause instanceof ApiError ? error.cause.message : fallback;
  return apiMessage(error, fallback);
}
