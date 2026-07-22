import { IsArray, IsBoolean, IsDateString, IsInt, IsNumber, IsObject, IsOptional, IsString, Max, Min } from 'class-validator';

export class MatchDto {
  @IsString() languageId!: string;
  @IsOptional() @IsString() currentLevel?: string;
  @IsString() learningGoal!: string;
  @IsOptional() @IsString() targetLevel?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(9) targetBand?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(9) currentBand?: number;
  @IsOptional() @IsDateString() examDate?: string;
  @IsArray() @IsString({ each: true }) weakSkills!: string[];
  @IsNumber() @Min(1) budget!: number;
  @IsArray() @IsInt({ each: true }) suitableDays!: number[];
  @IsOptional() @IsString() preferredTime?: string;
  @IsOptional() @IsString() preferredTeacherGender?: string;
  @IsBoolean() trialRequired!: boolean;
  @IsString() classType!: string;
  @IsOptional() @IsObject() availability?: object;
  @IsString() timezone!: string;
}
