import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

/** Request bodies for `PaymentsController` (checkout, gateway, refunds). */

export class PayDto {
  @IsIn(['booking', 'package']) purpose!: 'booking' | 'package';
  @IsString() referenceId!: string;
  @IsInt() @Min(0) walletAmount!: number;
  @IsOptional() @IsString() discountCode?: string;
  @IsString() idempotencyKey!: string;
}

export class RefundDto {
  @IsInt() @Min(1) amount!: number;
  @IsString() reason!: string;
  @IsString() idempotencyKey!: string;
}

export class WalletTopUpDto {
  @IsInt() @Min(100_000) amount!: number;
  @IsOptional() @IsString() discountCode?: string;
  @IsOptional() @IsString() idempotencyKey?: string;
}
