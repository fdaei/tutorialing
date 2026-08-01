import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

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
