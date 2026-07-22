import { IsIn } from 'class-validator';

export class LocaleDto {
  @IsIn(['fa', 'en']) locale!: 'fa' | 'en';
}
