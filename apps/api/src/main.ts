import 'reflect-metadata';
import './env';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/http';
import { validationResponse } from './common/errors';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const cfg = app.get(ConfigService);
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.use(helmet()); app.use(cookieParser());
  app.enableCors({ origin: cfg.get('app.webUrl'), credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist:true, transform:true, forbidNonWhitelisted:true, exceptionFactory: validationResponse }));
  app.useGlobalFilters(new ApiExceptionFilter());
  const swaggerConfig = new DocumentBuilder().setTitle('LingoSpeak API').setDescription('Bilingual IELTS teacher marketplace').setVersion('1.0').addBearerAuth().build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swaggerConfig));
  await app.listen(cfg.get('app.port'));
}
void bootstrap();
