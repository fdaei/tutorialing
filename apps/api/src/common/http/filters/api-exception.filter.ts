import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { prismaToDomain } from '../../errors/domain.exception';
import { requestLocale, type RequestLocale } from '../request-locale';

const legacyErrors: Record<RequestLocale, Record<string, string>> = {
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

function localize(value: string, locale: RequestLocale) {
  return legacyErrors[locale][value] ?? value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

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
      this.logger.error(
        {
          err: caught,
          requestId: response.getHeader('x-request-id'),
          method: request.method,
          path: request.url,
          statusCode: status,
        },
        'Unhandled request error',
      );
    }

    const localizedFields: Record<string, string> = {};
    if (isRecord(body.fieldErrors)) {
      for (const [field, detail] of Object.entries(body.fieldErrors)) {
        localizedFields[field] = isRecord(detail)
          ? String(detail[locale] ?? detail.en ?? detail.fa ?? '')
          : String(detail);
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
