import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { AdminCountriesController, AdminLanguagesController, CountriesController, LanguagesController } from './languages.controller';
import { LanguagesService } from './languages.service';

@Module({
  imports: [FilesModule],
  controllers: [LanguagesController, AdminLanguagesController, CountriesController, AdminCountriesController],
  providers: [LanguagesService],
  exports: [LanguagesService],
})
export class LanguagesModule {}
