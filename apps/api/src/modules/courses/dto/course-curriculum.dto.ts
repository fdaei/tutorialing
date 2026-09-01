import { CourseLessonType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CourseChapterDto {
  @IsString() @MinLength(2) @MaxLength(160) titleFa!: string;
  @IsString() @MinLength(2) @MaxLength(160) titleEn!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(1_000) order!: number;
  @IsOptional() @IsBoolean() published?: boolean;
}

export class CourseLessonDto {
  @IsString() @MinLength(2) @MaxLength(180) titleFa!: string;
  @IsString() @MinLength(2) @MaxLength(180) titleEn!: string;
  @IsOptional() @IsString() @MaxLength(2_000) descriptionFa?: string;
  @IsOptional() @IsString() @MaxLength(2_000) descriptionEn?: string;
  @IsEnum(CourseLessonType) type!: CourseLessonType;
  @IsOptional() @IsObject() content?: Record<string, unknown>;
  @IsOptional() @IsUrl({ require_protocol: true }) @MaxLength(2_000) mediaUrl?: string;
  @Type(() => Number) @IsInt() @Min(0) @Max(86_400) durationSeconds!: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(1_000) order!: number;
  @IsOptional() @IsBoolean() preview?: boolean;
  @IsOptional() @IsBoolean() published?: boolean;
}
