import { IsInt, Matches, Max, Min } from 'class-validator';

export class WithdrawalRequestDto {
  @IsInt() @Min(100_000) @Max(2_000_000_000)
  amount!: number;

  @Matches(/^IR\d{24}$/)
  iban!: string;
}
