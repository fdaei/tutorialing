import { Injectable } from '@nestjs/common';
import type { Booking } from '@prisma/client';
import { PrismaService, Tx } from '../../../infrastructure/database/prisma.service';
import { SettingsService } from '../../settings/settings.service';

const DEFAULT_COMMISSION_PERCENT = 20;
const DEFAULT_HOLD_DAYS = 7;
const DAY_MS = 86_400_000;

/**
 * Accrual side of the escrow: turns a completed lesson into a teacher `Earning`
 * and credits the teacher's share to their wallet.
 *
 * The commission rate is read from the `Setting` table rather than hardcoded so
 * the admin panel's "configure commission percentage" screen actually governs
 * it. `escrowHoldDays` keeps the dispute window: the money is visible in the
 * teacher's wallet immediately (which is what the product spec promises) while
 * `eligibleAt` gates when a payout run may include it.
 */
@Injectable()
export class EarningsService {
  constructor(
    private db: PrismaService,
    private settings: SettingsService,
  ) {}

  commissionPercent(tx: Tx = this.db) {
    return this.settings.numeric('commerce.commissionPercent', DEFAULT_COMMISSION_PERCENT, 100, tx);
  }

  escrowHoldDays(tx: Tx = this.db) {
    return this.settings.numeric('commerce.escrowHoldDays', DEFAULT_HOLD_DAYS, 365, tx);
  }

  /** Snapshots the teacher/platform split when the student's wallet payment commits. */
  async reserve(tx: Tx, booking: Pick<Booking, 'id' | 'teacherId' | 'price'>) {
    const percent = await this.commissionPercent(tx);
    const commissionAmount = Math.round((booking.price * percent) / 100);
    return tx.earning.upsert({
      where: { bookingId: booking.id },
      create: {
        teacherId: booking.teacherId,
        bookingId: booking.id,
        grossAmount: booking.price,
        commissionAmount,
        netAmount: booking.price - commissionAmount,
        status: 'PENDING',
        // Payout eligibility starts only after completion; this placeholder is
        // replaced by accrue() and cannot mature while the lesson is pending.
        eligibleAt: new Date('9999-12-31T00:00:00.000Z'),
      },
      update: {},
    });
  }

  /**
   * Records the teacher's earning for a completed lesson and credits the net
   * amount to their wallet. Both writes are keyed on the booking so replaying a
   * completion cannot pay a teacher twice.
   */
  async accrue(tx: Tx, booking: Pick<Booking, 'id' | 'teacherId' | 'price'>) {
    const holdDays = await this.escrowHoldDays(tx);
    const reserved = await this.reserve(tx, booking);
    const earning = await tx.earning.update({
      where: { id: reserved.id },
      data: { status: 'ELIGIBLE', eligibleAt: new Date(Date.now() + holdDays * DAY_MS) },
    });
    if (earning.netAmount > 0) {
      const teacher = await tx.teacher.findUniqueOrThrow({
        where: { id: booking.teacherId },
        select: { userId: true },
      });
      // Same `user_wallet` account the student side uses, so `walletBalance`
      // and `GET /payments/wallet` report a teacher's balance with no special
      // casing. The payout transfer debits it again when the money leaves.
      await tx.walletEntry.upsert({
        where: { idempotencyKey: `earning-credit:${earning.id}` },
        create: {
          userId: teacher.userId,
          transactionId: `tx_${earning.id}`,
          account: 'user_wallet',
          direction: 'CREDIT',
          amount: earning.netAmount,
          description: 'lesson earning (net of platform commission)',
          referenceType: 'Earning',
          referenceId: earning.id,
          idempotencyKey: `earning-credit:${earning.id}`,
        },
        update: {},
      });
    }
    return earning;
  }
}
