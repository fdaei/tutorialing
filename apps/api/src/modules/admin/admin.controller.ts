import { Body, Controller, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ArrayNotEmpty, IsArray, IsEmail, IsEnum, IsIn, IsOptional, IsString, Matches } from 'class-validator';
import { Role, UserStatus } from '@prisma/client';
import { CurrentUser, Permissions, Roles, type AuthUser } from '../../common/auth';
import { TeachersService } from '../teachers/teachers.service';
import { AdminService } from './admin.service';

class TransitionDto {
  @IsIn(['DOCUMENT_REVIEW', 'INTERVIEW', 'DEMO_REVIEW', 'APPROVED', 'REJECTED'])
  status!: any;

  @IsOptional()
  @IsString()
  note?: string;
}
class RoleDto {
  @IsString()
  userId!: string;

  @IsIn(['STUDENT', 'TEACHER', 'ADMIN', 'STAFF', 'EXAMINER', 'SUPPORT', 'FINANCE'])
  role!: Role;
}

class PermissionDto extends RoleDto {
  @IsString()
  permission!: string;
}
class CreateUserDto {
  @Matches(/^09\d{9}$/) phone!: string;
  @IsString() name!: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsIn(['fa','en']) locale?: string;
  @IsOptional() roles?: Role[];
}
class UserStatusDto { @IsIn(['ACTIVE','SUSPENDED','DELETED']) status!: UserStatus; }
class UserRolesDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(Role, { each: true })
  roles!: Role[];
}

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
  @Post('users')
  createUser(@CurrentUser() u: AuthUser, @Body() d: CreateUserDto) { return this.s.createUser(u.id, d); }

  @Permissions('roles.manage')
  @Patch('users/:id/status')
  userStatus(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: UserStatusDto) { return this.s.updateUserStatus(u.id, id, d.status); }

  @Permissions('roles.manage')
  @Patch('users/:id/roles')
  userRoles(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: UserRolesDto) { return this.s.setUserRoles(u.id, id, d.roles); }

  @Permissions('teachers.verify')
  @Get('teacher-applications')
  applications() { return this.s.applications(); }

  @Permissions('teachers.verify')
  @Post('teacher-applications/:id/transition')
  transition(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: TransitionDto) {
    return this.teachers.transition(id, d.status, u.id, d.note);
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
  @Post('roles')
  assignRole(@CurrentUser() u: AuthUser, @Body() d: RoleDto) { return this.s.assignRole(u.id, d.userId, d.role); }

  @Permissions('roles.manage')
  @Post('roles/revoke')
  revokeRole(@CurrentUser() u: AuthUser, @Body() d: RoleDto) { return this.s.revokeRole(u.id, d.userId, d.role); }

  @Permissions('roles.manage')
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
  @Put('settings/:key')
  setting(@Param('key') key: string, @Body() d: { value: unknown; public: boolean }) {
    return this.s.setSetting(key, d.value, d.public);
  }

  @Permissions('cms.manage')
  @Get('cms')
  cms() { return this.s.cms(); }

  @Permissions('cms.manage')
  @Put('cms/:slug')
  upsert(@Param('slug') slug: string, @Body() d: any) { return this.s.upsertCms(slug, d); }
}
