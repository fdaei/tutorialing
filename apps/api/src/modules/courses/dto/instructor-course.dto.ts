import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { PACKAGE_TIERS } from '@lingospeak/contracts';

/**
 * Lets an instructor create their own LIVE_ONLINE course. Unlike `AdminCourseDto`,
 * there is no `teacherId`, `price`, `published` or `packageId` here: the caller is
 * the teacher, the course always starts as an unpublished draft, and the session
 * package (with its admin-reviewed price) is created alongside it via
 * `PackagesService.createPackage` rather than accepted from the request.
 */
export class InstructorCourseDto {
  @IsString() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @MaxLength(120) slug!: string;
  @IsString() @MinLength(3) @MaxLength(180) titleFa!: string;
  @IsString() @MinLength(3) @MaxLength(180) titleEn!: string;
  @IsString() @MinLength(20) @MaxLength(10_000) descriptionFa!: string;
  @IsString() @MinLength(20) @MaxLength(10_000) descriptionEn!: string;
  @IsString() @MinLength(2) @MaxLength(80) language!: string;
  @IsString() @MinLength(2) @MaxLength(40) level!: string;
  @IsOptional() @IsString() @MaxLength(2_000) image?: string;
  /** Sellable session tiers: single session, 5, 10, 15, or 20. */
  @IsIn(PACKAGE_TIERS) credits!: number;
  @IsInt() @Min(15) @Max(240) lessonMinutes!: number;
  @IsInt() @Min(0) @Max(80) discountPercent!: number;
  @IsOptional() @IsBoolean() isTest?: boolean;
}
