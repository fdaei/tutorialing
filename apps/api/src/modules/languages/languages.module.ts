import { Module } from '@nestjs/common';
import { AdminCountriesController, AdminLanguagesController, CountriesController, LanguagesController } from './languages.controller';
import { LanguagesService } from './languages.service';

@Module({
  controllers: [LanguagesController, AdminLanguagesController, CountriesController, AdminCountriesController],
  providers: [LanguagesService],
  exports: [LanguagesService],
})
export class LanguagesModule {}
