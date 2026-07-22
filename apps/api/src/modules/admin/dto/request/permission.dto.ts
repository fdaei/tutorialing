import { IsString } from 'class-validator';
import { RoleDto } from './role.dto';

export class PermissionDto extends RoleDto {
  @IsString()
  permission!: string;
}
