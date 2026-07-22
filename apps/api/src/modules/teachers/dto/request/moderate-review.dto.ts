import { IsIn, IsOptional, IsString } from 'class-validator';

export class ModerateReviewDto {
  @IsIn(['APPROVED', 'REJECTED', 'NEEDS_REVISION']) status!: 'APPROVED' | 'REJECTED' | 'NEEDS_REVISION';
  @IsOptional() @IsString() note?: string;
}
