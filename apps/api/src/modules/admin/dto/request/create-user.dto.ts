import { Role } from '@prisma/client';
import { IsEmail, IsIn, IsOptional, IsString, Matches } from 'class-validator';

export class CreateUserDto {
  @Matches(/^09\d{9}$/) phone!: string;
  @IsString() name!: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsIn(['fa', 'en']) locale?: string;
  @IsOptional() roles?: Role[];
}
