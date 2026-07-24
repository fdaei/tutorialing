import { IsString, Length, Matches } from 'class-validator';

export class VerifyOtpDto {
  @IsString()
  challengeId!: string;

  @IsString()
  @Matches(/^09\d{9}$/)
  phone!: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  code!: string;
}
