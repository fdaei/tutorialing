import { IsOptional, IsString, Length } from 'class-validator';

export class PayoutApprovalDto {
  /** Bank or ledger reference recorded against the approved batch. */
  @IsOptional() @IsString() @Length(1, 200) reference?: string;
}
