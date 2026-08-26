import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AuthUser, CurrentUser, RateLimit, RATE_LIMIT_TIERS, Roles } from '../../common';
import { PermissionKeys, RequirePermissions } from '../auth/authorization';
import { CreateUserDto } from './dto/admin/create-user.dto';
import { UserStatusDto } from './dto/admin/user-status.dto';
import { AdminUsersService } from './admin-users.service';
import { ApiTags } from '@nestjs/swagger';

@Roles('ADMIN', 'STAFF')
@ApiTags('admin')
@Controller('admin')
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @RequirePermissions(PermissionKeys.Users.Read)
  @Get('users')
  list(@Query('page') page = '1', @Query('search') search = '', @Query('status') status = '') {
    return this.users.list(+page, search, status);
  }

  @RequirePermissions(PermissionKeys.Users.Read)
  @Get('users/:id')
  detail(@Param('id') id: string) { return this.users.detail(id); }

  @RequirePermissions(PermissionKeys.Roles.Manage)
  @RateLimit(RATE_LIMIT_TIERS.adminWrite)
  @Post('users')
  create(@CurrentUser() actor: AuthUser, @Body() dto: CreateUserDto) { return this.users.create(actor.id, dto); }

  @RequirePermissions(PermissionKeys.Roles.Manage)
  @RateLimit(RATE_LIMIT_TIERS.adminWrite)
  @Patch('users/:id/status')
  status(@CurrentUser() actor: AuthUser, @Param('id') id: string, @Body() dto: UserStatusDto) {
    return this.users.updateStatus(actor.id, id, dto.status);
  }
}
