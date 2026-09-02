import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser, Public, Roles, type AuthUser } from '../../../common';
import { PackagesService } from './packages.service';
import { PackageDto, PackageApprovalDto } from '../dto/request/packages.dto';

@Controller('packages')
export class PackagesController {
  constructor(private s: PackagesService) {}

  @Roles('INSTRUCTOR')
  @Post()
  create(@CurrentUser() u: AuthUser, @Body() d: PackageDto) {
    return this.s.createPackage(u.id, d);
  }

  @Get('enrollments/me')
  mine(@CurrentUser() u: AuthUser) {
    return this.s.enrollments(u.id);
  }

  @Roles('INSTRUCTOR')
  @Get('me')
  minePackages(@CurrentUser() u: AuthUser) {
    return this.s.mine(u.id);
  }

  @Public()
  @Get('teacher/:teacherId')
  forTeacher(@Param('teacherId') teacherId: string) {
    return this.s.listForTeacher(teacherId);
  }

  @Roles('ADMIN')
  @Post(':id/approval')
  approve(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: PackageApprovalDto) {
    return this.s.approvePackage(id, u.id, d.status);
  }
}
