import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { BOOKING_QUEUE, BookingQueue } from './booking-jobs.port';

@Injectable()
export class BookingJobsService {
  constructor(private readonly db: PrismaService, @Inject(BOOKING_QUEUE) private readonly queue: BookingQueue) {}

  scheduleExpiration(bookingId: string, expiresAt: Date) {
    return this.queue.addExpiration(bookingId, expiresAt);
  }

  async scheduleBooking(bookingId: string, startsAt: Date) {
    for (const [minutes, type] of [[1440, '24h'], [60, '1h']] as const) {
      const scheduledAt = new Date(startsAt.getTime() - minutes * 60e3);
      if (scheduledAt <= new Date()) continue;
      const reminder = await this.db.reminder.upsert({
        where: { bookingId_type: { bookingId, type } },
        create: { bookingId, type, scheduledAt },
        update: { scheduledAt, status: 'scheduled' },
      });
      await this.queue.addReminder(reminder.id, scheduledAt);
    }
  }
}
