import { IsString, Length } from 'class-validator';

export class SubmissionDto {
  @IsString() @Length(1, 20000) submission!: string;
}
