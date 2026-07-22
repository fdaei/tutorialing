import { IsIn, IsNumber, IsObject, IsString, Max, Min } from 'class-validator';

export class AnswerReviewDto {
  @IsString() answerId!: string;
  @IsNumber() @Min(0) @Max(9) band!: number;
  @IsObject() criteria!: object;
  @IsString() feedbackFa!: string;
  @IsString() feedbackEn!: string;
  @IsIn(['APPROVED', 'NEEDS_REVISION']) status!: 'APPROVED' | 'NEEDS_REVISION';
}
