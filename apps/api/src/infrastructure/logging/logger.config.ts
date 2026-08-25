import type { IncomingMessage, ServerResponse } from 'http';
import type { Params } from 'nestjs-pino';
import { requestId } from '../../common/request-id';
import { config } from '../../config';

const REDACTED = '[Redacted]';

export function loggerConfig(): Params {
  const env = config();

  return {
    pinoHttp: {
      name: env.SERVICE_NAME,
      level: env.LOG_LEVEL,
      transport: env.LOG_PRETTY
        ? {
            target: 'pino-pretty',
            options: { colorize: true, singleLine: true, translateTime: 'SYS:standard' },
          }
        : undefined,
      autoLogging: env.LOG_HTTP
        ? { ignore: (request) => !env.LOG_HEALTH_REQUESTS && request.url === '/api/health' }
        : false,
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'res.headers["set-cookie"]',
          '*.accessToken',
          '*.refreshToken',
          '*.password',
          '*.secret',
        ],
        censor: REDACTED,
      },
      genReqId(request: IncomingMessage, response: ServerResponse) {
        const id = requestId(request.headers['x-request-id']);
        response.setHeader('x-request-id', id);
        return id;
      },
      customProps(request) {
        return { requestId: request.id };
      },
      customLogLevel(_request, response, error) {
        if (error || response.statusCode >= 500) return 'error';
        if (response.statusCode >= 400) return 'warn';
        return 'info';
      },
      customSuccessMessage(request, response) {
        return `${request.method} ${request.url} completed with ${response.statusCode}`;
      },
      customErrorMessage(request, response) {
        return `${request.method} ${request.url} failed with ${response.statusCode}`;
      },
    },
  };
}
