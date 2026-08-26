import { Module } from '@nestjs/common';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';
import { ContentModule } from '../content/content.module';
import { AdminSupportController } from './admin-support.controller';
@Module({ imports: [ContentModule], controllers: [SupportController, AdminSupportController], providers: [SupportService] })
export class SupportModule {}
