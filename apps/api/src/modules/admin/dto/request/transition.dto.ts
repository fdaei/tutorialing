import { IsIn, IsOptional, IsString } from 'class-validator';

export class TransitionDto {
  @IsIn(['DOCUMENT_REVIEW', 'INTERVIEW', 'DEMO_REVIEW', 'APPROVED', 'REJECTED'])
  status!: string;

  @IsOptional()
  @IsString()
  note?: string;
}
