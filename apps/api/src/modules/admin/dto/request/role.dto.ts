import { Role } from '@prisma/client';
import { IsIn, IsString } from 'class-validator';

export class RoleDto {
  @IsString()
  userId!: string;

  @IsIn(['STUDENT', 'TEACHER', 'ADMIN', 'STAFF', 'EXAMINER', 'SUPPORT', 'FINANCE'])
  role!: Role;
}
