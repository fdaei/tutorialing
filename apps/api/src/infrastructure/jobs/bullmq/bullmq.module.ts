import { Global, Module } from '@nestjs/common';
import { BOOKING_QUEUE } from '../../../modules/bookings/booking-jobs.port';
import { BullmqBookingJobsAdapter } from './bullmq-booking-jobs.adapter';

@Global()
@Module({
  providers: [BullmqBookingJobsAdapter, { provide: BOOKING_QUEUE, useExisting: BullmqBookingJobsAdapter }],
  exports: [BOOKING_QUEUE],
})
export class BullmqModule {}
