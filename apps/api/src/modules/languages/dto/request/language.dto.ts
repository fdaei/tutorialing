import { LanguageDirection, ProficiencySystem } from '@prisma/client';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class LanguageDto {
  @IsString() @Length(2, 20) code!: string;
  @IsString() @Length(2, 100) nameFa!: string;
  @IsString() @Length(2, 100) nameEn!: string;
  @IsString() @Length(1, 100) nativeName!: string;
  @IsOptional() @IsString() @Length(1, 32) flag?: string;
  @IsEnum(LanguageDirection) direction!: LanguageDirection;
  @IsEnum(ProficiencySystem) proficiencySystem!: ProficiencySystem;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(10000) order?: number;
}
