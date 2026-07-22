import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class PayDto {
  @IsIn(['booking', 'package']) purpose!: 'booking' | 'package';
  @IsString() referenceId!: string;
  @IsInt() @Min(0) walletAmount!: number;
  @IsOptional() @IsString() discountCode?: string;
  @IsString() idempotencyKey!: string;
}
