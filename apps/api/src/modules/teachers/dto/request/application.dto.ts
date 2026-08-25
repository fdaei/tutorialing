import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

export class ApplicationDto {
  @IsString() @Length(2, 80) nameFa!: string;
  @IsString() @Length(2, 80) nameEn!: string;
  @IsString() @Length(40, 3000) bioFa!: string;
  @IsString() @Length(40, 3000) bioEn!: string;
  @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) specialties!: string[];
  @IsArray() @ArrayNotEmpty() @ArrayMaxSize(20) @IsString({ each: true }) languageIds!: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) levels?: string[];
  @IsInt() @Min(0) @Max(60) experienceYears!: number;
  @IsOptional() @IsIn(['female', 'male', 'other', 'prefer_not_to_say']) gender?: string;
  @IsOptional() @IsInt() @Min(20) @Max(180) lessonDuration?: number;
  @IsOptional() @IsInt() @Min(15) @Max(90) trialDuration?: number;
  @IsOptional() @IsInt() @Min(0) @Max(120) breakMinutes?: number;
}
