import { TicketStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class StatusDto {
  @IsEnum(TicketStatus) status!: TicketStatus;
  @IsOptional() @IsString() note?: string;
}
