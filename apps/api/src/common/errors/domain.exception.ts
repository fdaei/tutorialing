import { HttpException, HttpStatus, type ValidationError } from '@nestjs/common';

export type FieldErrorCodes = Record<string, string>;

export type DomainErrorDefinition = Readonly<{
  status: HttpStatus;
  code: string;
}>;

/**
 * Shared, language-neutral domain errors. The API only owns the stable code
 * and HTTP semantics; clients own the user-facing copy and its translations.
 */
export const DOMAIN_ERRORS = {
  TEACHER_PRICE_NOT_APPROVED: {
    status: HttpStatus.CONFLICT,
    code: 'TEACHER_PRICE_NOT_APPROVED',
  },
} as const satisfies Record<string, DomainErrorDefinition>;

export const domainError = (definition: DomainErrorDefinition) =>
  new HttpException({ code: definition.code }, definition.status);

export class DomainException extends HttpException {
  constructor(
    status: HttpStatus,
    code: string,
    fields: FieldErrorCodes = {},
    details: Record<string, unknown> = {},
  ) {
    super({ code, fieldErrors: fields, ...details }, status);
  }
}

export const badRequest = (code: string, fields: FieldErrorCodes = {}) =>
  new DomainException(HttpStatus.BAD_REQUEST, code, fields);
export const conflict = (code: string, fields: FieldErrorCodes = {}) =>
  new DomainException(HttpStatus.CONFLICT, code, fields);
export const forbidden = (code: string) => new DomainException(HttpStatus.FORBIDDEN, code);
export const unauthorized = (code: string) => new DomainException(HttpStatus.UNAUTHORIZED, code);
export const notFound = (code: string) => new DomainException(HttpStatus.NOT_FOUND, code);
export const tooManyRequests = (code: string, retryAfterSeconds?: number) =>
  new DomainException(
    HttpStatus.TOO_MANY_REQUESTS,
    code,
    {},
    retryAfterSeconds === undefined ? {} : { retryAfterSeconds },
  );

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
      return conflict('RESOURCE_ALREADY_EXISTS');
    case 'P2025':
      return notFound('RESOURCE_NOT_FOUND');
    case 'P2003':
      return badRequest('RELATED_RECORD_MISSING');
    case 'P2014':
      return conflict('RELATED_RECORD_IN_USE');
    // Serializable transaction aborted by a concurrent write. The booking and
    // wallet paths deliberately run at Serializable, so a genuine race here
    // surfaced as an untranslated 500 telling the user nothing. It is a retry,
    // not a fault: the caller reloads and tries again.
    case 'P2034':
      return conflict('CONCURRENT_UPDATE_CONFLICT');
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

function constraintCode(property: string, constraint: string): string {
  if (property === 'phone') return 'PHONE_INVALID';
  return `VALIDATION_${constraint.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase()}`;
}

export function validationResponse(errors: ValidationError[]) {
  const fields: FieldErrorCodes = {};
  const visit = (rows: ValidationError[], prefix = '') => {
    for (const row of rows) {
      const key = prefix ? `${prefix}.${row.property}` : row.property;
      const constraint = Object.keys(row.constraints ?? {})[0];
      if (constraint) fields[key] = constraintCode(row.property, constraint);
      if (row.children?.length) visit(row.children, key);
    }
  };
  visit(errors);
  return new DomainException(HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR', fields);
}
