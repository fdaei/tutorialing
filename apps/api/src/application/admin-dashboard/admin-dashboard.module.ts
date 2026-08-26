import { Module } from '@nestjs/common';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminDashboardService } from './admin-dashboard.service';
import { DashboardReadRepository } from './infrastructure/dashboard-read.repository';

@Module({ controllers: [AdminDashboardController], providers: [AdminDashboardService, DashboardReadRepository] })
export class AdminDashboardModule {}
