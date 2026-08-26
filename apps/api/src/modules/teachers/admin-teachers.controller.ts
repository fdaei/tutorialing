import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { TeacherStatus } from '@prisma/client';
import { AuthUser, CurrentUser, RateLimit, RATE_LIMIT_TIERS, Roles } from '../../common';
import { PermissionKeys, RequirePermissions } from '../auth/authorization';
import { TransitionDto } from './dto/admin/transition.dto';
import { TeachersService } from './teachers.service';
import { ApiTags } from '@nestjs/swagger';

@Roles('ADMIN', 'STAFF')
@ApiTags('admin')
@RequirePermissions(PermissionKeys.Teachers.Verify)
@Controller('admin')
export class AdminTeachersController {
  constructor(private readonly teachers: TeachersService) {}
  @Get('teacher-applications') applications() { return this.teachers.adminApplications(); }
  @RateLimit(RATE_LIMIT_TIERS.adminWrite)
  @Post('teacher-applications/:id/transition')
  transition(@CurrentUser() actor: AuthUser, @Param('id') id: string, @Body() dto: TransitionDto) {
    return this.teachers.transition(id, dto.status as TeacherStatus, actor.id, dto.note);
  }
}
