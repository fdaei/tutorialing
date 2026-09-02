import { API_ERROR_MESSAGES, type ApiLocale } from './error-messages';

function locale() {
  if (typeof document === 'undefined') return undefined;
  return document.documentElement.lang.startsWith('en') ? 'en' : 'fa';
}
const COMMON_ERROR_MESSAGES: Record<string, Record<ApiLocale, string>> = {
  INTERNAL_ERROR: { fa: 'خطای غیرمنتظره‌ای رخ داد. دوباره تلاش کنید.', en: 'An unexpected error occurred. Try again.' },
  REQUEST_FAILED: { fa: 'درخواست انجام نشد.', en: 'The request failed.' },
  INVALID_RESPONSE_BODY: {
    fa: 'پاسخ دریافتی از سرویس قابل خواندن نبود.',
    en: 'The service returned a response that could not be read.',
  },
  AUTHENTICATION_REQUIRED: { fa: 'برای ادامه وارد حساب کاربری شوید.', en: 'Sign in to continue.' },
  SESSION_UNAVAILABLE: {
    fa: 'نشست شما لغو شده یا حساب در دسترس نیست.',
    en: 'Your session was revoked or the account is unavailable.',
  },
  ACCESS_TOKEN_INVALID: {
    fa: 'نشست شما منقضی شده است. دوباره وارد شوید.',
    en: 'Your session has expired. Sign in again.',
  },
  ROLE_NOT_PERMITTED: {
    fa: 'نقش حساب شما اجازه انجام این عملیات را ندارد.',
    en: 'Your account role does not permit this operation.',
  },
  PERMISSION_NOT_GRANTED: {
    fa: 'مجوز لازم برای انجام این عملیات را ندارید.',
    en: 'You do not have the required permission.',
  },
  OTP_INVALID_OR_EXPIRED: {
    fa: 'کد تأیید نامعتبر یا منقضی شده است.',
    en: 'The verification code is invalid or expired.',
  },
  OTP_INCORRECT: { fa: 'کد تأیید صحیح نیست.', en: 'The verification code is incorrect.' },
  ACCOUNT_UNAVAILABLE: { fa: 'حساب کاربری در دسترس نیست.', en: 'The account is unavailable.' },
  REFRESH_TOKEN_REQUIRED: { fa: 'نشست معتبر پیدا نشد.', en: 'A valid session is required.' },
  REFRESH_TOKEN_INVALID: { fa: 'نشست معتبر نیست.', en: 'The session is invalid.' },
  REFRESH_TOKEN_EXPIRED_OR_REUSED: {
    fa: 'نشست منقضی یا باطل شده است.',
    en: 'The session has expired or been revoked.',
  },
  USER_NOT_FOUND: { fa: 'کاربر پیدا نشد.', en: 'User not found.' },
  SELF_ACCOUNT_DISABLE: { fa: 'نمی‌توانید حساب خودتان را غیرفعال کنید.', en: 'You cannot disable your own account.' },
  ROLE_REQUIRED: { fa: 'حداقل یک نقش لازم است.', en: 'At least one role is required.' },
  SELF_ADMIN_ROLE_REMOVE: {
    fa: 'نمی‌توانید نقش مدیر خودتان را حذف کنید.',
    en: 'You cannot remove your own admin role.',
  },
  LAST_ADMIN_ROLE_REMOVE: { fa: 'نقش آخرین مدیر قابل حذف نیست.', en: 'The last admin role cannot be removed.' },
  PERMISSION_NOT_FOUND: { fa: 'دسترسی پیدا نشد.', en: 'Permission not found.' },
  PACKAGE_NOT_FOUND: { fa: 'بسته پیدا نشد.', en: 'Package not found.' },
  PAYMENT_NOT_FOUND: { fa: 'پرداخت پیدا نشد.', en: 'Payment not found.' },
  REFUND_AMOUNT_INVALID: { fa: 'مبلغ بازپرداخت معتبر نیست.', en: 'The refund amount is invalid.' },
  STUDENT_RELATIONSHIP_REQUIRED: {
    fa: 'برای این عملیات سابقه آموزشی با زبان‌آموز لازم است.',
    en: 'A teaching relationship with the student is required.',
  },
  TEACHER_PRICE_NOT_APPROVED: {
    fa: 'تا زمانی که قیمت جلسه عادی تأیید نشده باشد، این عملیات امکان‌پذیر نیست.',
    en: 'This operation is unavailable until the regular lesson price has been approved.',
  },
  RESOURCE_ALREADY_EXISTS: { fa: 'این رکورد از قبل ثبت شده است.', en: 'This record already exists.' },
  RESOURCE_NOT_FOUND: { fa: 'رکورد موردنظر پیدا نشد.', en: 'The requested record was not found.' },
  RELATED_RECORD_MISSING: {
    fa: 'یکی از موارد مرتبط وجود ندارد یا حذف شده است.',
    en: 'A related record is missing or has been removed.',
  },
  RELATED_RECORD_IN_USE: {
    fa: 'این رکورد به رکوردهای دیگری وابسته است و قابل تغییر نیست.',
    en: 'This record is referenced by other records and cannot be changed.',
  },
  CONCURRENT_UPDATE_CONFLICT: {
    fa: 'این مورد هم‌زمان تغییر کرد. صفحه را دوباره بارگذاری و تلاش کنید.',
    en: 'This item changed concurrently. Reload and try again.',
  },
  VALIDATION_ERROR: {
    fa: 'بعضی اطلاعات فرم صحیح نیست. فیلدها را بررسی کنید.',
    en: 'Some form values are invalid. Review the fields.',
  },
  PHONE_INVALID: {
    fa: 'شماره موبایل با پیش‌شماره کشور مطابقت ندارد.',
    en: 'The mobile number does not match the selected country code.',
  },
  VALIDATION_IS_NOT_EMPTY: { fa: 'این فیلد نباید خالی باشد.', en: 'This field cannot be empty.' },
  VALIDATION_IS_STRING: { fa: 'این مقدار باید متن باشد.', en: 'This value must be text.' },
  VALIDATION_IS_NUMBER: { fa: 'این مقدار باید عدد باشد.', en: 'This value must be a number.' },
  VALIDATION_IS_INT: { fa: 'این مقدار باید عدد صحیح باشد.', en: 'This value must be a whole number.' },
  VALIDATION_IS_BOOLEAN: { fa: 'این مقدار باید درست یا نادرست باشد.', en: 'This value must be true or false.' },
  VALIDATION_IS_ARRAY: { fa: 'این فیلد باید یک فهرست باشد.', en: 'This field must be a list.' },
  VALIDATION_ARRAY_NOT_EMPTY: { fa: 'حداقل یک گزینه انتخاب کنید.', en: 'Select at least one option.' },
  VALIDATION_IS_DATE_STRING: { fa: 'تاریخ یا ساعت معتبر نیست.', en: 'The date or time is invalid.' },
  VALIDATION_IS_EMAIL: { fa: 'ایمیل معتبر وارد کنید.', en: 'Enter a valid email address.' },
  VALIDATION_IS_URL: { fa: 'نشانی اینترنتی معتبر وارد کنید.', en: 'Enter a valid URL.' },
  VALIDATION_IS_IN: { fa: 'یکی از گزینه‌های مجاز را انتخاب کنید.', en: 'Choose one of the allowed options.' },
  VALIDATION_IS_ENUM: { fa: 'یکی از گزینه‌های مجاز را انتخاب کنید.', en: 'Choose one of the allowed options.' },
  VALIDATION_MIN: { fa: 'مقدار واردشده کمتر از حداقل مجاز است.', en: 'The value is below the allowed minimum.' },
  VALIDATION_MAX: { fa: 'مقدار واردشده بیشتر از حداکثر مجاز است.', en: 'The value is above the allowed maximum.' },
  VALIDATION_MIN_LENGTH: { fa: 'متن واردشده کوتاه‌تر از حد مجاز است.', en: 'The entered text is too short.' },
  VALIDATION_MAX_LENGTH: { fa: 'متن واردشده طولانی‌تر از حد مجاز است.', en: 'The entered text is too long.' },
  VALIDATION_MATCHES: { fa: 'فرمت مقدار واردشده صحیح نیست.', en: 'The entered value has an invalid format.' },
  VALIDATION_WHITELIST_VALIDATION: {
    fa: 'این فیلد توسط سامانه پذیرفته نمی‌شود.',
    en: 'This field is not accepted by the API.',
  },
};
function errorMessage(code: string | undefined, values: Array<string | number> = []) {
  if (!code) return undefined;
  const lang = locale() ?? 'fa';
  return (COMMON_ERROR_MESSAGES[code] ?? API_ERROR_MESSAGES[code])?.[lang]
    ?.replace(/\{(\d+)\}/g, (_, index: string) => String(values[Number(index)] ?? ''))
    .replace(/\s{2,}/g, ' ')
    .trim();
}
export type ApiErrorBody = {
  code?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
  requestId?: string;
  timestamp?: string;
  retryAfterSeconds?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeApiErrorBody(details: unknown): ApiErrorBody {
  if (!isRecord(details)) return {};
  const fieldErrors = isRecord(details.fieldErrors)
    ? Object.fromEntries(Object.entries(details.fieldErrors).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
    : undefined;
  return {
    code: typeof details.code === 'string' ? details.code : undefined,
    message: typeof details.message === 'string' ? details.message : undefined,
    fieldErrors,
    requestId: typeof details.requestId === 'string' ? details.requestId : undefined,
    timestamp: typeof details.timestamp === 'string' ? details.timestamp : undefined,
    retryAfterSeconds: typeof details.retryAfterSeconds === 'number' ? details.retryAfterSeconds : undefined,
  };
}

export class ApiError extends Error {
  details: ApiErrorBody;
  constructor(
    public status: number,
    details: unknown,
  ) {
    const body = normalizeApiErrorBody(details);
    super(
      errorMessage(body.code, body.retryAfterSeconds === undefined ? [] : [body.retryAfterSeconds]) ||
        body.message ||
        errorMessage(status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_FAILED'),
    );
    this.name = 'ApiError';
    this.details = {
      ...body,
      fieldErrors: Object.fromEntries(
        Object.entries(body.fieldErrors ?? {}).map(([field, code]) => [field, errorMessage(code) ?? code]),
      ),
    };
  }
}

export function apiMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : error instanceof Error ? error.message : fallback;
}
export function apiField(error: unknown, field: string) {
  return error instanceof ApiError ? error.details.fieldErrors?.[field] : undefined;
}
