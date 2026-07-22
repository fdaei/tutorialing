import { IsDateString, IsOptional, IsString } from 'class-validator';

export class BlockDto {
  @IsDateString() startsAt!: string;
  @IsDateString() endsAt!: string;
  @IsOptional() @IsString() reason?: string;
  @IsOptional() @IsString() teacherId?: string;
}
