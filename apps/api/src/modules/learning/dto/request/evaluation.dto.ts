import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';

export class EvaluationDto {
  @IsString() bookingId!: string;
  @IsOptional() @IsNumber() currentBand?: number;
  @IsArray() weakSkills!: string[];
  @IsString() notes!: string;
  @IsOptional() @IsString() recommendedPackageId?: string;
}
