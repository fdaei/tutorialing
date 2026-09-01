import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class CourseProgressDto {
  @IsOptional() @IsBoolean() completed?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(86_400) positionSeconds?: number;
}
