import { Global, Module } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import {
  AuditService,
  RedisService,
  SettingsService,
  TokenRevocationService,
} from './services';

const providers = [
  PrismaService,
  AuditService,
  RedisService,
  SettingsService,
  TokenRevocationService,
];

@Global()
@Module({ providers, exports: providers })
export class CoreModule {}
