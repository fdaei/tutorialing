import { IsInternationalPhone } from '../../../../common/validators/is-international-phone.decorator';

export class RequestOtpDto {
  @IsInternationalPhone()
  phone!: string;
}
