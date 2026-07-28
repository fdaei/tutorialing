import { IsString, Length } from 'class-validator';

export class IntroVideoDto {
  @IsString() @Length(1, 100) fileId!: string;
}
