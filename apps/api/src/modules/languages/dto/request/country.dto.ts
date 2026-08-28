import { IsBoolean, IsInt, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';

export class CountryDto {
  @IsString() @Matches(/^[A-Z]{2}$/) code!: string;
  @IsString() @Length(1, 100) nameFa!: string;
  @IsString() @Length(1, 100) nameEn!: string;
  @IsString() @Matches(/^\+[1-9]\d{0,3}$/) dialCode!: string;
  @IsString() @Length(2, 8) flag!: string;
  @IsInt() @Min(1) @Max(15) minLength!: number;
  @IsInt() @Min(1) @Max(15) maxLength!: number;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(10000) order?: number;
}

export class UpdateCountryDto {
  @IsOptional() @IsString() @Matches(/^[A-Z]{2}$/) code?: string;
  @IsOptional() @IsString() @Length(1, 100) nameFa?: string;
  @IsOptional() @IsString() @Length(1, 100) nameEn?: string;
  @IsOptional() @IsString() @Matches(/^\+[1-9]\d{0,3}$/) dialCode?: string;
  @IsOptional() @IsString() @Length(2, 8) flag?: string;
  @IsOptional() @IsInt() @Min(1) @Max(15) minLength?: number;
  @IsOptional() @IsInt() @Min(1) @Max(15) maxLength?: number;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(10000) order?: number;
}
