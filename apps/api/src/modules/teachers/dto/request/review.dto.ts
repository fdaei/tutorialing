import { DocumentStatus } from '@prisma/client';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class ReviewDto {
  @IsIn(['UNDER_REVIEW', 'APPROVED', 'REJECTED', 'NEEDS_REVISION']) status!: DocumentStatus;
  @IsOptional() @IsString() note?: string;
}
