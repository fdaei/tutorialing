import 'reflect-metadata';
import './env';
import { NestFactory } from '@nestjs/core';
import { Logger, LoggerErrorInterceptor } from 'nestjs-pino';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common';
import { validationResponse } from './common';
import { config } from './config';
import { runtimeEnvironment } from './common/utils';

async function bootstrap() {
  const cfg = config();
  const runtime = runtimeEnvironment(cfg.NODE_ENV);
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  const logger = app.get(Logger);
  app.useLogger(logger);
  app.useGlobalInterceptors(new LoggerErrorInterceptor());
  app.setGlobalPrefix('api');
  // Must be set before the per-IP rate limiter reads `request.ip`; see TRUST_PROXY.
  app.set('trust proxy', cfg.TRUST_PROXY);
  app.use(helmet());
  // JSON responses compress 70-90%; the API never streams binary content
  // itself (file up/downloads go through presigned MinIO URLs), so there's
  // no download/SSE path this could interfere with. threshold keeps tiny
  // responses (e.g. `{ ok: true }`) from paying gzip's per-request overhead
  // for no size benefit.
  app.use(compression({ threshold: 1024 }));
  app.use(cookieParser());
  app.enableCors({ origin: cfg.WEB_URL, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      exceptionFactory: validationResponse,
    }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());
  // `/docs` enumerates every route, its DTO shape, and its auth requirements —
  // a ready-made map of the attack surface. It stays off in production, where
  // the schema should be published deliberately rather than served anonymously.
  if (!runtime.isProduction) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('LingoSpeak API')
      .setDescription('Bilingual IELTS teacher marketplace')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swaggerConfig));
  }
  await app.listen(Number(cfg.PORT));
  logger.log({ port: Number(cfg.PORT), environment: cfg.NODE_ENV }, 'API started');
}
void bootstrap();
