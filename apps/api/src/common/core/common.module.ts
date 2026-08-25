import { Global, Module } from '@nestjs/common';
import { AuditService, SettingsService, TokenRevocationService } from './services';

const providers = [AuditService, SettingsService, TokenRevocationService];

@Global()
@Module({ providers, exports: providers })
export class CoreModule {}
