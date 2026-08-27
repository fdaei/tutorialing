import { IsString, Length, Matches } from 'class-validator';
import { IsInternationalPhone } from '../../../../common/validators/is-international-phone.decorator';

export class VerifyOtpDto {
  @IsString()
  challengeId!: string;

  @IsInternationalPhone()
  phone!: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  code!: string;
}
