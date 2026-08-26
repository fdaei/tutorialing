import { IsString } from 'class-validator';

export class StartDto {
  @IsString() testId!: string;
}
