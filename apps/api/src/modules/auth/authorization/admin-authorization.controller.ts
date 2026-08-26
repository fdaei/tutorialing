import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser, RateLimit, RATE_LIMIT_TIERS, Roles, AuthUser } from '../../../common';
import { AuthorizationManagementService } from './authorization-management.service';
import { PermissionKeys } from './permission-registry';
import { RequirePermissions } from './require-permissions.decorator';
import { RoleDto } from './role.dto';
import { PermissionDto } from './permission.dto';
import { UserRolesDto } from './user-roles.dto';
import { ApiTags } from '@nestjs/swagger';

@Roles('ADMIN', 'STAFF')
@ApiTags('admin')
@RequirePermissions(PermissionKeys.Roles.Manage)
@Controller('admin')
export class AdminAuthorizationController {
  constructor(private readonly authorization: AuthorizationManagementService) {}

  @Get('roles') roles() { return this.authorization.roles(); }
  @Get('permissions') permissions() { return this.authorization.permissions(); }

  @RateLimit(RATE_LIMIT_TIERS.adminWrite)
  @Patch('users/:id/roles')
  setRoles(@CurrentUser() actor: AuthUser, @Param('id') id: string, @Body() dto: UserRolesDto) {
    return this.authorization.setUserRoles(actor.id, id, dto.roles);
  }

  @RateLimit(RATE_LIMIT_TIERS.adminWrite)
  @Post('roles')
  assign(@CurrentUser() actor: AuthUser, @Body() dto: RoleDto) {
    return this.authorization.assignRole(actor.id, dto.userId, dto.role);
  }

  @RateLimit(RATE_LIMIT_TIERS.adminWrite)
  @Post('roles/revoke')
  revoke(@CurrentUser() actor: AuthUser, @Body() dto: RoleDto) {
    return this.authorization.revokeRole(actor.id, dto.userId, dto.role);
  }

  @RateLimit(RATE_LIMIT_TIERS.adminWrite)
  @Post('permissions/grant')
  grant(@CurrentUser() actor: AuthUser, @Body() dto: PermissionDto) {
    return this.authorization.grantPermission(actor.id, dto.userId, dto.role, dto.permission);
  }
}
