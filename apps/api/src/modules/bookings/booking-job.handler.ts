import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { config } from '../../config';
import { releaseDiscount } from '../commerce';
import { SMS_PROVIDER, SmsProvider } from '../../infrastructure/messaging/sms/sms-provider';

/**
 * Formats a lesson start time for a Kavenegar lookup token.
 *
 * Two problems with sending `startsAt.toISOString()`, which is what this used to
 * do. Kavenegar rejects lookup tokens containing spaces and punctuation such as
 * `:`, so the reminder SMS would fail to send at all; and a UTC instant is the
 * wrong thing to show a student whose lesson time was quoted in their own zone.
 * The booking's stored timezone is used, and the output is restricted to digits
 * and hyphens so it always survives token validation.
 *
 * NOTE: the `lingospeak-reminder` template and this token format have to be
 * confirmed against the Kavenegar panel before launch — the exact accepted
 * character set is not documented and cannot be verified without a live key.
 */
export function reminderToken(startsAt: Date, timezone: string) {
  const zone = (() => {
    try {
      new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(startsAt);
      return timezone;
    } catch {
      return 'Asia/Tehran';
    }
  })();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(startsAt);
  const value = (kind: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === kind)?.value ?? '';
  return {
    date: `${value('year')}-${value('month')}-${value('day')}`,
    time: `${value('hour')}-${value('minute')}`,
  };
}

@Injectable()
export class BookingJobHandler {
  private cfg = config();
  constructor(
    private db: PrismaService,
    @Inject(SMS_PROVIDER) private provider: SmsProvider,
  ) {}

  async handle(name: string, data: Record<string, string>) {
        if (name === 'booking-expiration') {
          if (data.bookingId) await this.expireBooking(data.bookingId);
          return;
        }
        if (name !== 'booking-reminder') return;
        if (!data.reminderId) return;
        const reminder = await this.db.reminder.findUnique({
          where: { id: data.reminderId },
          include: { booking: { include: { student: true, teacher: { include: { user: true } } } } },
        });
        if (!reminder || reminder.status !== 'scheduled' || reminder.booking.status !== 'CONFIRMED') return;
        const failures: unknown[] = [];
        // Same lesson time for both recipients, so it is formatted once. Rendered
        // in the booking's timezone rather than UTC — see `reminderToken`.
        const when = reminderToken(reminder.booking.startsAt, reminder.booking.timezone);
        for (const user of [reminder.booking.student, reminder.booking.teacher.user]) {
          const dedupeKey = `reminder:${reminder.id}:${user.id}`;
          const notification =
            (await this.db.notification.findUnique({
              where: { idempotencyKey: dedupeKey },
              include: { deliveries: true },
            })) ??
            (await this.db.notification.create({
              data: {
                userId: user.id,
                type: 'class-reminder',
                idempotencyKey: dedupeKey,
                titleFa: 'یادآوری کلاس',
                titleEn: 'Class reminder',
                bodyFa: `کلاس شما در تاریخ ${when.date} ساعت ${when.time.replace('-', ':')} برگزار می‌شود.`,
                bodyEn: `Your class starts on ${when.date} at ${when.time.replace('-', ':')}.`,
                deliveries: { create: { channel: 'IN_APP', status: 'sent', sentAt: new Date() } },
              },
              include: { deliveries: true },
            }));
          if (notification.deliveries.some((d) => d.channel === 'SMS' && d.status === 'sent')) continue;
          const delivery =
            notification.deliveries.find((d) => d.channel === 'SMS') ??
            (await this.db.notificationDelivery.create({
              data: { notificationId: notification.id, channel: 'SMS', status: 'sending', attempts: 1 },
            }));
          try {
            let providerId: string, response: object;
            if (this.provider.configured) {
              ({ response, providerId } = await this.provider.sendLookup({
                phone: user.phone,
                template: this.cfg.KAVENEGAR_REMINDER_TEMPLATE,
                tokens: [when.date, when.time],
              }));
            } else {
              providerId = `development-${Date.now()}`;
              response = { adapter: 'development', phone: user.phone, startsAt: reminder.booking.startsAt };
            }
            await this.db.notificationDelivery.update({
              where: { id: delivery.id },
              data: { status: 'sent', providerId, providerResponse: response, sentAt: new Date() },
            });
          } catch (error) {
            await this.db.notificationDelivery.update({
              where: { id: delivery.id },
              data: {
                status: 'failed',
                attempts: { increment: 1 },
                providerResponse: { error: error instanceof Error ? error.message : 'delivery failed' },
              },
            });
            failures.push(error);
          }
        }
        await this.db.reminder.update({
          where: { id: reminder.id },
          data: { status: failures.length ? 'scheduled' : 'sent', attempts: { increment: 1 } },
        });
        if (failures.length) throw failures[0];
  }

  async expireBooking(bookingId: string) {
    await this.db.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({ where: { id: bookingId }, include: { payment: true } });
      if (
        !booking ||
        booking.status !== 'PENDING_PAYMENT' ||
        !booking.paymentExpiresAt ||
        booking.paymentExpiresAt > new Date()
      )
        return;
      await tx.booking.update({
        where: { id: bookingId },
        data: { status: 'CANCELLED', cancelledAt: new Date(), cancellationReason: 'payment_expired' },
      });
      if (booking.payment?.status === 'PENDING') {
        if (booking.payment.walletAmount > 0)
          await tx.walletEntry.create({
            data: {
              userId: booking.payment.userId,
              transactionId: `tx_${booking.payment.id}`,
              account: 'user_wallet',
              direction: 'CREDIT',
              amount: booking.payment.walletAmount,
              description: 'expired payment wallet rollback',
              referenceType: 'Payment',
              referenceId: booking.payment.id,
              idempotencyKey: `wallet-expire:${booking.payment.id}`,
            },
          });
        // An expired checkout abandons its discount reservation just like a failed
        // one does, so the use has to go back to the code here too.
        await releaseDiscount(tx, booking.payment.discountId);
        await tx.payment.update({
          where: { id: booking.payment.id },
          data: { status: 'EXPIRED', callbackPayload: { reason: 'payment_expired' } },
        });
      }
      if (booking.enrollmentId)
        await tx.creditEntry.create({
          data: {
            enrollmentId: booking.enrollmentId,
            bookingId,
            type: 'RESTORE',
            amount: 1,
            idempotencyKey: `expire-restore:${bookingId}`,
          },
        });
    });
  }
}
