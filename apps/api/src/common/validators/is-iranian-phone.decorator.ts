import { applyDecorators } from '@nestjs/common';
import { IsString, Matches } from 'class-validator';

const IRANIAN_MOBILE_PATTERN = /^09\d{9}$/;

export const IsIranianPhone = () => applyDecorators(IsString(), Matches(IRANIAN_MOBILE_PATTERN));
