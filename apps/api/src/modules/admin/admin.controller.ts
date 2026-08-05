import { TeacherStatus } from '@prisma/client';
import { Body, Controller, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { CurrentUser, Permissions, RateLimit, RATE_LIMIT_TIERS, Roles, type AuthUser } from '../../common';
import { TeachersService } from '../teachers/teachers.service';
import { AdminService } from './admin.service';
import { TransitionDto } from './dto/request/transition.dto';
import { RoleDto } from './dto/request/role.dto';
import { PermissionDto } from './dto/request/permission.dto';
import { CreateUserDto } from './dto/request/create-user.dto';
import { UserStatusDto } from './dto/request/user-status.dto';
import { UserRolesDto } from './dto/request/user-roles.dto';
import { SettingDto } from './dto/request/setting.dto';
import { CmsPageDto } from './dto/request/cms-page.dto';

@Roles('ADMIN', 'STAFF')
@Controller('admin')
export class AdminController {
  constructor(private s: AdminService, private teachers: TeachersService) {}

  @Get('dashboard')
  dashboard() { return this.s.dashboard(); }

  @Permissions('users.read')
  @Get('users')
  users(@Query('page') p = '1', @Query('search') search = '', @Query('status') status = '') { return this.s.users(+p, search, status); }

  @Permissions('users.read')
  @Get('users/:id')
  user(@Param('id') id: string) { return this.s.userDetail(id); }

  @Permissions('roles.manage')
  @RateLimit(RATE_LIMIT_TIERS.adminWrite)
  @Post('users')
  createUser(@CurrentUser() u: AuthUser, @Body() d: CreateUserDto) { return this.s.createUser(u.id, d); }

  @Permissions('roles.manage')
  @RateLimit(RATE_LIMIT_TIERS.adminWrite)
  @Patch('users/:id/status')
  userStatus(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: UserStatusDto) { return this.s.updateUserStatus(u.id, id, d.status); }

  @Permissions('roles.manage')
  @RateLimit(RATE_LIMIT_TIERS.adminWrite)
  @Patch('users/:id/roles')
  userRoles(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: UserRolesDto) { return this.s.setUserRoles(u.id, id, d.roles); }

  @Permissions('teachers.verify')
  @Get('teacher-applications')
  applications() { return this.s.applications(); }

  @Permissions('teachers.verify')
  @RateLimit(RATE_LIMIT_TIERS.adminWrite)
  @Post('teacher-applications/:id/transition')
  transition(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: TransitionDto) {
    return this.teachers.transition(id, d.status as TeacherStatus, u.id, d.note);
  }

  @Permissions('bookings.read')
  @Get('bookings')
  bookings() { return this.s.bookings(); }

  @Permissions('tickets.read')
  @Get('tickets')
  tickets() { return this.s.tickets(); }

  @Permissions('notifications.read')
  @Get('notification-deliveries')
  notificationDeliveries() { return this.s.notificationDeliveries(); }

  @Permissions('roles.manage')
  @Get('roles')
  roles() { return this.s.roles(); }

  @Permissions('roles.manage')
  @Get('permissions')
  permissions() { return this.s.permissions(); }

  @Permissions('roles.manage')
  @RateLimit(RATE_LIMIT_TIERS.adminWrite)
  @Post('roles')
  assignRole(@CurrentUser() u: AuthUser, @Body() d: RoleDto) { return this.s.assignRole(u.id, d.userId, d.role); }

  @Permissions('roles.manage')
  @RateLimit(RATE_LIMIT_TIERS.adminWrite)
  @Post('roles/revoke')
  revokeRole(@CurrentUser() u: AuthUser, @Body() d: RoleDto) { return this.s.revokeRole(u.id, d.userId, d.role); }

  @Permissions('roles.manage')
  @RateLimit(RATE_LIMIT_TIERS.adminWrite)
  @Post('permissions/grant')
  grantPermission(@CurrentUser() u: AuthUser, @Body() d: PermissionDto) { return this.s.grantPermission(u.id, d.userId, d.role, d.permission); }

  @Permissions('reports.read')
  @Get('reports')
  reports() { return this.s.reports(); }

  @Permissions('audit.read')
  @Get('audit-logs')
  audit() { return this.s.audit(); }

  @Permissions('payments.read')
  @Get('payments')
  payments() { return this.s.payments(); }

  @Permissions('settings.manage')
  @Get('settings')
  settings() { return this.s.settings(); }

  @Permissions('settings.manage')
  @RateLimit(RATE_LIMIT_TIERS.adminWrite)
  @Put('settings/:key')
  setting(@Param('key') key: string, @Body() d: SettingDto) {
    return this.s.setSetting(key, d.value, d.public);
  }

  @Permissions('cms.manage')
  @Get('cms')
  cms() { return this.s.cms(); }

  @Permissions('cms.manage')
  @RateLimit(RATE_LIMIT_TIERS.adminWrite)
  @Put('cms/:slug')
  upsert(@Param('slug') slug: string, @Body() d: CmsPageDto) { return this.s.upsertCms(slug, d); }
}
