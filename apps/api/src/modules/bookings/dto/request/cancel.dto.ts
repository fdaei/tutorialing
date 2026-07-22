import { IsString } from 'class-validator';

export class CancelDto {
  @IsString() reason!: string;
}
