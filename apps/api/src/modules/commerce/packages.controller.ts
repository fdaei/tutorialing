import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser, Roles, type AuthUser } from '../../common/auth';
import { PackagesService } from './packages.service';
import { PackageDto } from './dto/request/package.dto';

@Controller('packages')
export class PackagesController {
  constructor(private s: PackagesService) {}

  @Roles('TEACHER')
  @Post()
  create(@CurrentUser() u: AuthUser, @Body() d: PackageDto) {
    return this.s.createPackage(u.id, d);
  }

  @Get('enrollments/me')
  mine(@CurrentUser() u: AuthUser) {
    return this.s.enrollments(u.id);
  }

  @Roles('ADMIN', 'STAFF')
  @Post(':id/approval')
  approve(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: { status: 'APPROVED' | 'REJECTED' }) {
    return this.s.approvePackage(id, u.id, d.status);
  }
}
