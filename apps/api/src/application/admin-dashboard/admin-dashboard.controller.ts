import { Controller, Get } from '@nestjs/common';
import { Roles } from '../../common';
import { ApiTags } from '@nestjs/swagger';
import { AdminDashboardService } from './admin-dashboard.service';

@Roles('ADMIN', 'STAFF')
@ApiTags('admin')
@Controller('admin')
export class AdminDashboardController {
  constructor(private readonly dashboard: AdminDashboardService) {}

  @Get('dashboard')
  getDashboard() {
    return this.dashboard.get();
  }
}
