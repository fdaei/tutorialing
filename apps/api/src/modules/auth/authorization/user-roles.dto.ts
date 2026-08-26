import { Role } from '@prisma/client';
import { ArrayNotEmpty, IsArray, IsEnum } from 'class-validator';

export class UserRolesDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(Role, { each: true })
  roles!: Role[];
}
