import { applyDecorators } from '@nestjs/common';
import { IsString, Matches } from 'class-validator';

// E.164: a leading + followed by 8–15 digits; country-specific validation and
// deliverability remain the SMS provider's responsibility.
const INTERNATIONAL_PHONE_PATTERN = /^\+[1-9]\d{7,14}$/;

export const IsInternationalPhone = () => applyDecorators(IsString(), Matches(INTERNATIONAL_PHONE_PATTERN));
