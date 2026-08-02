import { IsDateString, IsIn, IsInt, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';

/** Request bodies for `PayoutsController` and `TeacherFinanceController`. */

export class PayoutWindowDto {
  @IsDateString() weekStart!: string;
  @IsDateString() weekEnd!: string;
}

export class PayoutApprovalDto {
  /** Bank or ledger reference recorded against the approved batch. */
  @IsOptional() @IsString() @Length(1, 200) reference?: string;
}

export class WithdrawalRequestDto {
  @IsInt() @Min(100_000) @Max(2_000_000_000)
  amount!: number;

  @Matches(/^IR\d{24}$/)
  iban!: string;

  /**
   * Matches `PayDto.idempotencyKey`/`RefundDto.idempotencyKey`. Serializable
   * isolation stops two concurrent withdrawals from over-drawing the balance,
   * but it cannot tell a deliberate second withdrawal from a double-click —
   * both are valid on their own. This is what makes a retry converge on the
   * original request rather than creating a second one.
   */
  @IsString() @Length(8, 128)
  idempotencyKey!: string;
}

export class DiscountDto {
  @IsString() code!: string;
  // Anything other than the literal string 'percent' silently falls into the
  // fixed-amount branch wherever this is consumed (payments.service.ts,
  // auto-discounts.service.ts), so a typo like "percentage" would previously
  // have created a huge fixed-amount discount instead of being rejected.
  @IsIn(['percent', 'fixed']) type!: 'percent' | 'fixed';
  @IsInt() @Min(1) @Max(1_000_000_000) value!: number;
  @IsOptional() @IsInt() @Min(1) maxUses?: number;
  @IsOptional() @IsString() startsAt?: string;
  @IsOptional() @IsString() endsAt?: string;
}
