import { Role } from '@prisma/client';
import { IsIn, IsString } from 'class-validator';

export class RoleDto {
  @IsString()
  userId!: string;

  @IsIn(['STUDENT', 'INSTRUCTOR', 'SUPPORT', 'ADMIN'])
  role!: Role;
}
