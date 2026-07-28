import { IsBoolean, IsObject, IsOptional, IsString, Length } from 'class-validator';

export class CmsPageDto {
  @IsOptional() @IsString() @Length(1, 200) titleFa?: string;
  @IsOptional() @IsString() @Length(1, 200) titleEn?: string;
  @IsOptional() @IsObject() contentFa?: Record<string, unknown>;
  @IsOptional() @IsObject() contentEn?: Record<string, unknown>;
  @IsOptional() @IsObject() seo?: Record<string, unknown>;
  @IsOptional() @IsBoolean() published?: boolean;
}
