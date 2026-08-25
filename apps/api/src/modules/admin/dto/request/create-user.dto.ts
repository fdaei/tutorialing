import { Role } from '@prisma/client';
import { IsArray, IsEmail, IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import { IsIranianPhone } from '../../../../common/validators/is-iranian-phone.decorator';

export class CreateUserDto {
  @IsIranianPhone() phone!: string;
  @IsString() name!: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsIn(['fa', 'en']) locale?: string;
  @IsOptional() @IsArray() @IsEnum(Role, { each: true }) roles?: Role[];
}
