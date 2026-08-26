import { Global, Module } from '@nestjs/common';
import { BookingsController } from './bookings.controller';
import { AvailabilityController } from './availability.controller';
import { BookingsService } from './bookings.service';
import { BookingsRepository } from './bookings.repository';
import { AvailabilityService } from './availability.service';
import { BookingJobHandler } from './booking-job.handler';
import { BookingJobsService } from './booking-jobs.service';
import { CommerceModule } from '../commerce/commerce.module';
import { AdminBookingsController } from './admin-bookings.controller';
@Module({
  imports: [CommerceModule],
  controllers: [BookingsController, AvailabilityController, AdminBookingsController],
  providers: [BookingsService, BookingsRepository, AvailabilityService, BookingJobHandler, BookingJobsService],
  exports: [BookingsService, AvailabilityService, BookingJobHandler, BookingJobsService],
})
@Global()
export class BookingsModule {}
