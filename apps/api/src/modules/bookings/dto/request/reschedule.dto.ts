import { IsDateString, IsString } from 'class-validator';

export class RescheduleDto {
  @IsDateString() startsAt!: string;
  @IsString() timezone!: string;
}
