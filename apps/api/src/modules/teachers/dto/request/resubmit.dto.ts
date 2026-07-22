import { IsString } from 'class-validator';

export class ResubmitDto {
  @IsString() fileId!: string;
}
