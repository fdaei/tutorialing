import { Role } from '@prisma/client';
import { IsArray, IsEmail, IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import { IsInternationalPhone } from '../../../../common/validators/is-international-phone.decorator';

export class CreateUserDto {
  @IsInternationalPhone() phone!: string;
  @IsString() name!: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsIn(['fa', 'en']) locale?: string;
  @IsOptional() @IsArray() @IsEnum(Role, { each: true }) roles?: Role[];
}
