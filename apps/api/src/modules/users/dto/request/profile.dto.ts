import { IsEmail, IsIn, IsISO8601, IsOptional, IsString, Length } from 'class-validator';

export class ProfileDto {
  @IsString() @Length(2, 80) name!: string;
  @IsOptional() @IsEmail() email?: string;
  @IsIn(['fa', 'en']) locale!: 'fa' | 'en';
  @IsString() timezone!: string;
  /**
   * Date only (`YYYY-MM-DD`). Drives the automatic birthday discount. The client
   * converts from the Jalali picker before sending; the API stores and compares
   * Gregorian only.
   */
  @IsOptional() @IsISO8601({ strict: true }) birthDate?: string;
}
