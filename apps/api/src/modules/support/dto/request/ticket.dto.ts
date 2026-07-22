import { IsIn, IsOptional, IsString, Length } from 'class-validator';

export class TicketDto {
  @IsString() @Length(3, 160) subject!: string;
  @IsString() category!: string;
  @IsIn(['low', 'normal', 'high', 'urgent']) priority!: string;
  @IsString() @Length(2, 5000) body!: string;
  @IsOptional() @IsString() attachmentId?: string;
}
