import { Injectable, type NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { requestLocale } from '../utils/request-locale.util';

const SAFE_REQUEST_ID = /^[A-Za-z0-9_-]{1,100}$/;

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction) {
    const supplied = request.headers['x-request-id'];
    const requestId = typeof supplied === 'string' && SAFE_REQUEST_ID.test(supplied)
      ? supplied
      : randomUUID();

    response.setHeader('x-request-id', requestId);
    response.setHeader('content-language', requestLocale(request));
    next();
  }
}
