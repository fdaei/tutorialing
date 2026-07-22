import { IsInt, IsString, Min } from 'class-validator';

export class RefundDto {
  @IsInt() @Min(1) amount!: number;
  @IsString() reason!: string;
  @IsString() idempotencyKey!: string;
}
