import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class RescheduleDto {
  @IsDateString() startsAt!: string;
  @IsString() timezone!: string;
}

export class RescheduleDeclineDto {
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}
