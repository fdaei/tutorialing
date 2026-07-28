import { IsDateString } from 'class-validator';

export class PayoutWindowDto {
  @IsDateString() weekStart!: string;
  @IsDateString() weekEnd!: string;
}
