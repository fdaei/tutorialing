import { ApiError } from '@/shared/services/api';
import { UploadError, uploadErrorMessage } from '../upload-errors';

const fallback = 'آپلود انجام نشد. دوباره تلاش کنید.';
const leaky = 'https://storage.invalid/private-signature?token=secret internal response';

describe('upload error messages', () => {
  it('keeps the localized API message the UI showed before the workflow was extracted', () => {
    const wrapped = new UploadError('create', new ApiError(413, { message: 'حجم فایل بیش از حد مجاز است.' }));
    expect(uploadErrorMessage(wrapped, fallback)).toBe('حجم فایل بیش از حد مجاز است.');
  });

  it('collapses transport failures to the caller fallback instead of leaking URLs or tokens', () => {
    const wrapped = new UploadError('storage', new TypeError(leaky));
    const message = uploadErrorMessage(wrapped, fallback);
    expect(message).toBe(fallback);
    expect(message).not.toMatch(/signature|token|internal response/i);
  });

  it('never surfaces the internal stage text of an unwrapped upload failure', () => {
    expect(uploadErrorMessage(new UploadError('finalize'), fallback)).toBe(fallback);
    expect(uploadErrorMessage(new UploadError('cancelled'), fallback)).toBe(fallback);
  });

  it('leaves non-upload API errors exactly as the components rendered them', () => {
    expect(uploadErrorMessage(new ApiError(500, { message: 'سرور پاسخ نداد.' }), fallback)).toBe('سرور پاسخ نداد.');
  });

  it('preserves localized validation messages thrown by feature services', () => {
    expect(uploadErrorMessage(new Error('فرمت فایل پشتیبانی نمی‌شود.'), fallback)).toBe('فرمت فایل پشتیبانی نمی‌شود.');
  });

  it('falls back when the failure is not an Error at all', () => {
    expect(uploadErrorMessage('boom', fallback)).toBe(fallback);
  });
});
