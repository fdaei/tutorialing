import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { TeacherStatus } from '@prisma/client';
import { AuthUser, CurrentUser, RateLimit, RATE_LIMIT_TIERS, Roles } from '../../common';
import { PermissionKeys, RequirePermissions } from '../auth/authorization';
import { TransitionDto } from './dto/admin/transition.dto';
import { AdminTeacherDto, AdminUpdateTeacherDto } from './dto/admin/teacher.dto';
import { TeachersService } from './teachers.service';
import { ApiTags } from '@nestjs/swagger';

@Roles('ADMIN')
@ApiTags('admin')
@RequirePermissions(PermissionKeys.Teachers.Verify)
@Controller('admin')
export class AdminTeachersController {
  constructor(private readonly teachers: TeachersService) {}

  @Get('teachers')
  list(
    @Query('page') page = '1',
    @Query('limit') limit = '24',
    @Query('search') search = '',
    @Query('status') status = '',
  ) {
    return this.teachers.adminList(
      Math.max(1, Number(page)),
      Math.min(100, Math.max(1, Number(limit))),
      search,
      status,
    );
  }

  @Get('teachers/:id')
  detail(@Param('id') id: string) {
    return this.teachers.adminDetail(id);
  }

  @RateLimit(RATE_LIMIT_TIERS.adminWrite)
  @Post('teachers')
  create(@CurrentUser() actor: AuthUser, @Body() dto: AdminTeacherDto) {
    return this.teachers.adminCreate(actor.id, dto);
  }

  @RateLimit(RATE_LIMIT_TIERS.adminWrite)
  @Patch('teachers/:id')
  update(@CurrentUser() actor: AuthUser, @Param('id') id: string, @Body() dto: AdminUpdateTeacherDto) {
    return this.teachers.adminUpdate(actor.id, id, dto);
  }

  @Get('teacher-applications') applications() { return this.teachers.adminApplications(); }
  @RateLimit(RATE_LIMIT_TIERS.adminWrite)
  @Post('teacher-applications/:id/transition')
  transition(@CurrentUser() actor: AuthUser, @Param('id') id: string, @Body() dto: TransitionDto) {
    return this.teachers.transition(id, dto.status as TeacherStatus, actor.id, dto.note);
  }
}
