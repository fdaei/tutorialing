import { UserStatus } from '@prisma/client';
import { IsIn } from 'class-validator';

export class UserStatusDto {
  @IsIn(['ACTIVE', 'SUSPENDED', 'DELETED']) status!: UserStatus;
}
