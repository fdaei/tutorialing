import { IsBoolean, IsDateString, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class OverrideDto {
  @IsDateString() date!: string;
  @IsBoolean() available!: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(1439) startMinute?: number;
  @IsOptional() @IsInt() @Min(1) @Max(1440) endMinute?: number;
  @IsOptional() @IsString() reason?: string;
}
