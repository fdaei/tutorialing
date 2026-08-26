import { Module } from '@nestjs/common';
import { ContentService } from './content.service';
import { AdminContentController } from './admin-content.controller';

@Module({ controllers: [AdminContentController], providers: [ContentService], exports: [ContentService] })
export class ContentModule {}
