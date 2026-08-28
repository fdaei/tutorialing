import { IsInt, IsString, Length, Max, Min } from 'class-validator';

export class CourseReviewDto {
  @IsInt() @Min(1) @Max(5) rating!: number;
  @IsString() @Length(10, 3000) comment!: string;
}
