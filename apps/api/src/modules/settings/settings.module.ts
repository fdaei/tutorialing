import { Global, Module } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { AdminSettingsController } from './admin-settings.controller';

@Global()
@Module({ controllers: [AdminSettingsController], providers: [SettingsService], exports: [SettingsService] })
export class SettingsModule {}
