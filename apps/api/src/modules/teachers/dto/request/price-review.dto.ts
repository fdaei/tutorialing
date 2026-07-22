import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class PriceReviewDto {
  @IsIn(['start_review', 'counter', 'reject', 'recommend_approval', 'approve']) action!: 'start_review' | 'counter' | 'reject' | 'recommend_approval' | 'approve';
  @IsOptional() @IsInt() @Min(10000) counterTrialPrice?: number;
  @IsOptional() @IsInt() @Min(10000) counterRegularPrice?: number;
  @IsOptional() @IsString() note?: string;
}
