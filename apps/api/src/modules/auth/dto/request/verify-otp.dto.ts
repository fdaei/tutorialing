import { IsString, Length, Matches } from 'class-validator';
import { IsIranianPhone } from '../../../../common/validators/is-iranian-phone.decorator';

export class VerifyOtpDto {
  @IsString()
  challengeId!: string;

  @IsIranianPhone()
  phone!: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  code!: string;
}
