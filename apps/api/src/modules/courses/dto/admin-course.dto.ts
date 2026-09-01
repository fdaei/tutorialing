import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export class AdminCourseDto {
  @IsString() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @MaxLength(120) slug!: string;
  @IsString() @MinLength(3) @MaxLength(180) titleFa!: string;
  @IsString() @MinLength(3) @MaxLength(180) titleEn!: string;
  @IsString() @MinLength(20) @MaxLength(10_000) descriptionFa!: string;
  @IsString() @MinLength(20) @MaxLength(10_000) descriptionEn!: string;
  @IsString() @MinLength(2) @MaxLength(80) language!: string;
  @IsIn(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']) level!: string;
  @IsOptional() @IsString() teacherId?: string;
  @Type(() => Number) @IsInt() @Min(0) @Max(2_000_000_000) price!: number;
  @IsOptional() @IsString() @MaxLength(2_000) image?: string;
  @IsBoolean() published!: boolean;
}
