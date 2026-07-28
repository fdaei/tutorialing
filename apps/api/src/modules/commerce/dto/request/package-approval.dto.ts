import { IsIn } from 'class-validator';

export class PackageApprovalDto {
  @IsIn(['APPROVED', 'REJECTED'])
  status!: 'APPROVED' | 'REJECTED';
}
