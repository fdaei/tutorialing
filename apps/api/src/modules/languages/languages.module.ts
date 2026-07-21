import { Module } from '@nestjs/common';
import { AdminLanguagesController, LanguagesController } from './languages.controller';
import { LanguagesService } from './languages.service';

@Module({ controllers: [LanguagesController, AdminLanguagesController], providers: [LanguagesService], exports: [LanguagesService] })
export class LanguagesModule {}
