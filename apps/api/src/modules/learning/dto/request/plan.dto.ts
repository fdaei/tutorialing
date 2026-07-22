import { IsArray, IsDateString, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class PlanDto {
  @IsString() studentId!: string;
  @IsString() title!: string;
  @IsNumber() @Min(4) @Max(9) targetBand!: number;
  @IsOptional() @IsDateString() examDate?: string;
  @IsArray() weakSkills!: string[];
  @IsArray() milestones!: { title: string; dueAt?: string; order: number }[];
}
