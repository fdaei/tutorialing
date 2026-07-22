import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

export class ReplyDto {
  @IsString() @Length(2, 5000) body!: string;
  @IsOptional() @IsString() attachmentId?: string;
  @IsOptional() @IsBoolean() internal?: boolean;
}
