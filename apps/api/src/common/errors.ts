import { HttpException, HttpStatus, type ValidationError } from '@nestjs/common';

export type LocalizedFields = Record<string, { fa: string; en: string }>;

export class DomainException extends HttpException {
  constructor(
    status: HttpStatus,
    code: string,
    message: { fa: string; en: string },
    fields: LocalizedFields = {},
  ) {
    super({ code, messageFa: message.fa, messageEn: message.en, fieldErrors: fields }, status);
  }
}

export const badRequest = (code: string, fa: string, en: string, fields: LocalizedFields = {}) =>
  new DomainException(HttpStatus.BAD_REQUEST, code, { fa, en }, fields);
export const conflict = (code: string, fa: string, en: string, fields: LocalizedFields = {}) =>
  new DomainException(HttpStatus.CONFLICT, code, { fa, en }, fields);
export const forbidden = (code: string, fa: string, en: string) =>
  new DomainException(HttpStatus.FORBIDDEN, code, { fa, en });
export const notFound = (code: string, fa: string, en: string) =>
  new DomainException(HttpStatus.NOT_FOUND, code, { fa, en });
export const tooManyRequests = (code: string, fa: string, en: string) =>
  new DomainException(HttpStatus.TOO_MANY_REQUESTS, code, { fa, en });

/**
 * Prisma's known request errors otherwise reach the client as an untranslated
 * 500 with the raw driver message. Only the codes that represent a caller
 * mistake are mapped; anything else stays a 500 so genuine faults are not
 * disguised as client errors.
 */
export function prismaToDomain(error: unknown): DomainException | undefined {
  if (!isPrismaKnownError(error)) return undefined;
  switch (error.code) {
    case 'P2002':
      return conflict(
        'RESOURCE_ALREADY_EXISTS',
        'این رکورد از قبل ثبت شده است.',
        'This record already exists.',
      );
    case 'P2025':
      return notFound('RESOURCE_NOT_FOUND', 'رکورد موردنظر پیدا نشد.', 'The requested record was not found.');
    case 'P2003':
      return badRequest(
        'RELATED_RECORD_MISSING',
        'یکی از موارد مرتبط وجود ندارد یا حذف شده است.',
        'A related record is missing or has been removed.',
      );
    case 'P2014':
      return conflict(
        'RELATED_RECORD_IN_USE',
        'این رکورد به رکوردهای دیگری وابسته است و قابل تغییر نیست.',
        'This record is referenced by other records and cannot be changed.',
      );
    // Serializable transaction aborted by a concurrent write. The booking and
    // wallet paths deliberately run at Serializable, so a genuine race here
    // surfaced as an untranslated 500 telling the user nothing. It is a retry,
    // not a fault: the caller reloads and tries again.
    case 'P2034':
      return conflict(
        'CONCURRENT_UPDATE_CONFLICT',
        'این مورد هم‌زمان توسط درخواست دیگری تغییر کرد. صفحه را دوباره بارگذاری کنید و مجدد تلاش کنید.',
        'This item was changed by another request at the same time. Reload the page and try again.',
      );
    default:
      return undefined;
  }
}

/**
 * Structural check rather than `instanceof`: the API and the generated Prisma
 * client can resolve to different module instances, which makes `instanceof`
 * silently false.
 */
export function isPrismaKnownError(error: unknown): error is { code: string; meta?: unknown } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string' &&
    /^P\d{4}$/.test((error as { code: string }).code)
  );
}

function constraintMessage(property: string, constraint: string): { fa: string; en: string } {
  if (property === 'phone') return {
    fa: 'شماره موبایل باید با 09 شروع شود و دقیقاً 11 رقم داشته باشد؛ مانند 09123456789.',
    en: 'The mobile number must start with 09 and contain exactly 11 digits, for example 09123456789.',
  };
  const dictionary: Record<string, { fa: string; en: string }> = {
    isNotEmpty: { fa: 'این فیلد نباید خالی باشد.', en: 'This field cannot be empty.' },
    isString: { fa: 'این مقدار باید متن باشد.', en: 'This value must be text.' },
    isNumber: { fa: 'این مقدار باید عدد باشد.', en: 'This value must be a number.' },
    isInt: { fa: 'این مقدار باید عدد صحیح باشد.', en: 'This value must be a whole number.' },
    isBoolean: { fa: 'این مقدار باید درست یا نادرست باشد.', en: 'This value must be true or false.' },
    isArray: { fa: 'این فیلد باید یک فهرست باشد.', en: 'This field must be a list.' },
    arrayNotEmpty: { fa: 'حداقل یک گزینه انتخاب کنید.', en: 'Select at least one option.' },
    isDateString: { fa: 'تاریخ یا ساعت معتبر نیست. تاریخ را از تقویم انتخاب کنید.', en: 'The date or time is invalid. Select it from the date picker.' },
    isEmail: { fa: 'ایمیل معتبر وارد کنید؛ مانند name@example.com.', en: 'Enter a valid email address, such as name@example.com.' },
    isUrl: { fa: 'نشانی اینترنتی معتبر وارد کنید.', en: 'Enter a valid URL.' },
    isIn: { fa: 'یکی از گزینه‌های مجاز را انتخاب کنید.', en: 'Choose one of the allowed options.' },
    isEnum: { fa: 'یکی از گزینه‌های مجاز را انتخاب کنید.', en: 'Choose one of the allowed options.' },
    min: { fa: 'مقدار واردشده کمتر از حداقل مجاز است.', en: 'The value is below the allowed minimum.' },
    max: { fa: 'مقدار واردشده بیشتر از حداکثر مجاز است.', en: 'The value is above the allowed maximum.' },
    minLength: { fa: 'متن واردشده کوتاه‌تر از حد مجاز است.', en: 'The entered text is too short.' },
    maxLength: { fa: 'متن واردشده طولانی‌تر از حد مجاز است.', en: 'The entered text is too long.' },
    matches: { fa: 'فرمت مقدار واردشده صحیح نیست.', en: 'The entered value has an invalid format.' },
    whitelistValidation: { fa: 'این فیلد توسط سامانه پذیرفته نمی‌شود؛ آن را حذف کنید.', en: 'This field is not accepted by the API; remove it and try again.' },
  };
  return dictionary[constraint] ?? {
    fa: `مقدار فیلد «${property}» صحیح نیست. مقدار را بررسی و دوباره وارد کنید.`,
    en: `The value of “${property}” is invalid. Review it and try again.`,
  };
}

export function validationResponse(errors: ValidationError[]) {
  const fields: LocalizedFields = {};
  const visit = (rows: ValidationError[], prefix = '') => {
    for (const row of rows) {
      const key = prefix ? `${prefix}.${row.property}` : row.property;
      const constraint = Object.keys(row.constraints ?? {})[0];
      if (constraint) fields[key] = constraintMessage(row.property, constraint);
      if (row.children?.length) visit(row.children, key);
    }
  };
  visit(errors);
  return new DomainException(HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR', {
    fa: 'بعضی اطلاعات فرم صحیح نیست. پیام زیر هر فیلد را بخوانید و آن را اصلاح کنید.',
    en: 'Some form values are invalid. Read the message below each field and correct it.',
  }, fields);
}
