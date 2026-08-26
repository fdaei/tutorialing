export const BOOKING_QUEUE = Symbol('BOOKING_QUEUE');

export interface BookingQueue {
  addExpiration(bookingId: string, expiresAt: Date): Promise<void>;
  addReminder(reminderId: string, scheduledAt: Date): Promise<void>;
}
