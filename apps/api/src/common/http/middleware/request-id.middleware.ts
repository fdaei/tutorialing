import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { requestId } from '../../request-id';
import { requestLocale } from '../request-locale';

// The Pino HTTP logger (see infrastructure/logging) assigns and validates an
// id via the same helper before this middleware runs; prefer that one so the
// response header always matches what's in the logs, rather than minting a
// second, unrelated id when the client sent none.
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction) {
    const id = requestId(response.getHeader('x-request-id') ?? request.headers['x-request-id']);
    request.headers['x-request-id'] = id;
    response.setHeader('x-request-id', id);
    response.setHeader('content-language', requestLocale(request));
    next();
  }
}
