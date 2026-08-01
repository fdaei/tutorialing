import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NestMiddleware,
} from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { prismaToDomain, type LocalizedFields } from './errors';

type Locale = 'fa' | 'en';

const legacyErrors: Record<Locale, Record<string, string>> = {
  fa: {
    'Internal server error': 'خطای غیرمنتظره‌ای رخ داد. لطفاً دوباره تلاش کنید.',
    'Request failed': 'درخواست انجام نشد.',
    'Authentication required': 'برای ادامه وارد حساب کاربری شوید.',
    'Invalid or expired access token': 'نشست شما منقضی شده است. دوباره وارد شوید.',
    'Role not permitted': 'نقش حساب شما اجازه انجام این عملیات را ندارد.',
    'Permission not granted': 'مجوز لازم برای انجام این عملیات را ندارید.',
    'Attempt is closed': 'این جلسه آزمون بسته شده است.',
  },
  en: {},
};

function requestLocale(req: Request): Locale {
  return String(req.headers['accept-language'] ?? 'fa').toLowerCase().startsWith('en') ? 'en' : 'fa';
}
function localize(value: string, locale: Locale) {
  return legacyErrors[locale][value] ?? value;
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly log = new Logger(ApiExceptionFilter.name);

  catch(caught: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request>();
    const locale = requestLocale(request);
    // Translate constraint violations into the bilingual DomainException shape
    // before formatting, so a duplicate key surfaces as a 409 the UI can read
    // rather than a raw 500 carrying the driver's message.
    const error = prismaToDomain(caught) ?? caught;
    const status = error instanceof HttpException ? error.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const rawBody = error instanceof HttpException ? error.getResponse() : 'Internal server error';
    const body = isRecord(rawBody) ? rawBody : { message: rawBody };

    if (status >= 500) {
      // Log the original error: the mapped DomainException has no stack worth keeping.
      this.log.error(`${request.method} ${request.url}`, caught instanceof Error ? caught.stack : String(caught));
    }

    const localizedFields: Record<string, string> = {};
    if (isRecord(body.fieldErrors)) {
      for (const [field, detail] of Object.entries(body.fieldErrors as LocalizedFields)) {
        if (isRecord(detail)) localizedFields[field] = String(detail[locale] ?? detail.en ?? detail.fa ?? '');
        else localizedFields[field] = String(detail);
      }
    }

    const fallbackMessage = Array.isArray(body.message)
      ? body.message.map(String).join(' ')
      : String(body.message ?? 'Request failed');
    const message = String(
      body[locale === 'fa' ? 'messageFa' : 'messageEn'] ?? localize(fallbackMessage, locale),
    );

    response.status(status).json({
      statusCode: status,
      code: String(body.code ?? (status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_FAILED')),
      message,
      fieldErrors: localizedFields,
      locale,
      path: request.url,
      requestId: response.getHeader('x-request-id'),
      timestamp: new Date().toISOString(),
    });
  }
}

// Only a short, safe-charset client-supplied id is trusted for correlation;
// anything else (unbounded length, unexpected characters) falls back to a
// fresh id rather than being reflected verbatim into the response header,
// logs, and downstream tracing systems.
const SAFE_REQUEST_ID = /^[A-Za-z0-9_-]{1,100}$/;

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const supplied = req.headers['x-request-id'];
    const id = typeof supplied === 'string' && SAFE_REQUEST_ID.test(supplied) ? supplied : randomUUID();
    res.setHeader('x-request-id', id);
    res.setHeader('content-language', requestLocale(req));
    next();
  }
}
