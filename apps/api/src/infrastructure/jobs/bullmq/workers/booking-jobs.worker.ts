import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Worker } from 'bullmq';
import { BookingJobHandler } from '../../../../modules/bookings/booking-job.handler';
import { BOOKING_QUEUE_NAME, bullmqConnection } from '../bullmq-booking-jobs.adapter';

@Injectable()
export class BookingJobsWorker implements OnModuleInit, OnModuleDestroy {
  private worker?: Worker;
  constructor(private readonly handler: BookingJobHandler) {}

  onModuleInit() {
    this.worker = new Worker(BOOKING_QUEUE_NAME, (job) => this.handler.handle(job.name, job.data), {
      connection: bullmqConnection(), concurrency: 5,
    });
  }

  async onModuleDestroy() { await this.worker?.close(); }
}
