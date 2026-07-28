import { LanguageDirection, ProficiencySystem } from '@prisma/client';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

/**
 * PATCH counterpart to `LanguageDto`. It cannot be expressed as
 * `Partial<LanguageDto>` on the handler: that is a TypeScript type, not a class,
 * so `ValidationPipe` has no metatype to validate against and the body would
 * reach the service completely unchecked.
 */
export class UpdateLanguageDto {
  @IsOptional() @IsString() @Length(2, 20) code?: string;
  @IsOptional() @IsString() @Length(2, 100) nameFa?: string;
  @IsOptional() @IsString() @Length(2, 100) nameEn?: string;
  @IsOptional() @IsString() @Length(1, 100) nativeName?: string;
  @IsOptional() @IsString() @Length(1, 32) flag?: string;
  @IsOptional() @IsEnum(LanguageDirection) direction?: LanguageDirection;
  @IsOptional() @IsEnum(ProficiencySystem) proficiencySystem?: ProficiencySystem;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(10000) order?: number;
}
