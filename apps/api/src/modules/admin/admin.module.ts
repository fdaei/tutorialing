import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminRepository } from './admin.repository';
import { TeachersModule } from '../teachers/teachers.module';
import { DashboardStatsService } from './dashboard-stats.service';
import { RoleManagementPolicy } from './role-management.policy';
@Module({
  imports: [TeachersModule],
  controllers: [AdminController],
  providers: [AdminService, AdminRepository, DashboardStatsService, RoleManagementPolicy],
})
export class AdminModule {}
