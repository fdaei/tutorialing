import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { config } from '../../../config';
import { BookingQueue } from '../../../modules/bookings/booking-jobs.port';

export const BOOKING_QUEUE_NAME = 'notifications';

export function bullmqConnection() {
  const redisUrl = new URL(config().REDIS_URL);
  return { host: redisUrl.hostname, port: Number(redisUrl.port || 6379), password: redisUrl.password || undefined, maxRetriesPerRequest: null };
}

@Injectable()
export class BullmqBookingJobsAdapter implements BookingQueue, OnModuleDestroy {
  private readonly queue = new Queue(BOOKING_QUEUE_NAME, { connection: bullmqConnection() });

  async addExpiration(bookingId: string, expiresAt: Date) {
    await this.queue.add('booking-expiration', { bookingId }, {
      jobId: `expiration-${bookingId}`, delay: Math.max(0, expiresAt.getTime() - Date.now()), attempts: 3,
      backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: true, removeOnFail: { count: 500 },
    });
  }

  async addReminder(reminderId: string, scheduledAt: Date) {
    await this.queue.add('booking-reminder', { reminderId }, {
      jobId: `reminder-${reminderId}`, delay: scheduledAt.getTime() - Date.now(), attempts: 5,
      backoff: { type: 'exponential', delay: 30000 }, removeOnComplete: true, removeOnFail: { count: 500 },
    });
  }

  async onModuleDestroy() { await this.queue.close(); }
}
