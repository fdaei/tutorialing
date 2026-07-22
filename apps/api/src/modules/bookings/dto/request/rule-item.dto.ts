import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class RuleItemDto {
  @IsInt() @Min(0) @Max(6) weekday!: number;
  @IsInt() @Min(0) @Max(1439) startMinute!: number;
  @IsInt() @Min(1) @Max(1440) endMinute!: number;
  @IsString() timezone!: string;
  @IsOptional() @IsInt() @Min(15) @Max(240) lessonDuration?: number;
  @IsOptional() @IsInt() @Min(0) @Max(120) breakMinutes?: number;
}
