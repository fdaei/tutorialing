import { IsString, Length } from 'class-validator';

export class ReplyReviewDto {
  @IsString() @Length(2, 2000) response!: string;
}
