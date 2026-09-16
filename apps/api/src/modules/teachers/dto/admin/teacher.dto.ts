import { PartialType } from '@nestjs/swagger';
import { TeacherStatus } from '@prisma/client';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { IsIranianPhone } from '../../../../common/validators/is-iranian-phone.decorator';

export class AdminTeacherDto {
  @IsIranianPhone() phone!: string;
  @IsOptional() @IsEmail() email?: string | null;
  @IsString() @Length(2, 80) nameFa!: string;
  @IsString() @Length(2, 80) nameEn!: string;
  @IsString() @Length(40, 3000) bioFa!: string;
  @IsString() @Length(40, 3000) bioEn!: string;
  @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) specialties!: string[];
  @IsArray() @ArrayNotEmpty() @ArrayMaxSize(20) @IsString({ each: true }) languageIds!: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) levels?: string[];
  @IsInt() @Min(0) @Max(60) experienceYears!: number;
  @IsOptional() @IsString() @Length(1, 40) gender?: string;
  @IsOptional() @IsInt() @Min(20) @Max(180) lessonDuration?: number;
  @IsOptional() @IsInt() @Min(15) @Max(90) trialDuration?: number;
  @IsOptional() @IsInt() @Min(0) @Max(120) breakMinutes?: number;
  @IsOptional() @IsInt() @Min(0) trialPrice?: number;
  @IsOptional() @IsInt() @Min(0) regularPrice?: number;
  @IsOptional() @IsInt() @Min(0) approvedTrialPrice?: number | null;
  @IsOptional() @IsInt() @Min(0) approvedRegularPrice?: number | null;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsInt({ each: true }) targetBands?: number[];
  @IsOptional() @IsString() @Length(1, 100) avatarFileId?: string | null;
  @IsOptional() @IsEnum(TeacherStatus) status?: TeacherStatus;
}

/** PATCH body: every field optional — the service falls back to the stored value. */
export class AdminUpdateTeacherDto extends PartialType(AdminTeacherDto) {}
