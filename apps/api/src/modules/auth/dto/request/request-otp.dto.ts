import { IsIranianPhone } from '../../../../common/validators/is-iranian-phone.decorator';

export class RequestOtpDto {
  @IsIranianPhone()
  phone!: string;
}
