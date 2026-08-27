import { Module } from '@nestjs/common';
import { BookingJobsWorker } from '../../infrastructure/jobs/bullmq/workers/booking-jobs.worker';
import { BookingsModule } from '../../modules/bookings/bookings.module';
import { BookingReminderReconciler } from './booking-reminder.reconciler';
import { DashboardStatsReconciler } from './dashboard-stats.reconciler';
import { OutboxDispatcher } from './outbox.dispatcher';

@Module({
  imports: [BookingsModule],
  providers: [BookingJobsWorker, DashboardStatsReconciler, OutboxDispatcher, BookingReminderReconciler],
})
export class WorkersModule {}
