import { Module } from '@nestjs/common';
import { BookingJobsWorker } from '../../infrastructure/jobs/bullmq/workers/booking-jobs.worker';
import { BookingsModule } from '../../modules/bookings/bookings.module';
import { DashboardStatsReconciler } from './dashboard-stats.reconciler';

@Module({ imports: [BookingsModule], providers: [BookingJobsWorker, DashboardStatsReconciler] })
export class WorkersModule {}
