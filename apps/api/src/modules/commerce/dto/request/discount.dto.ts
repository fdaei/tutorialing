import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class DiscountDto {
  @IsString() code!: string;
  @IsString() type!: string;
  @IsInt() @Min(1) value!: number;
  @IsOptional() @IsInt() @Min(1) maxUses?: number;
  @IsOptional() @IsString() startsAt?: string;
  @IsOptional() @IsString() endsAt?: string;
}
