import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService, Tx } from '../../prisma.service';
import { conflict, isPrismaKnownError } from '../../common/errors';
import { config } from '../../config';
import { QueueService } from '../queue/queue.service';
import { GatewayService } from './gateway.service';
import { WalletService } from './wallet.service';
import { PayDto } from './dto/request/pay.dto';
import { releaseDiscount } from './discount-reservation';

@Injectable()
export class PaymentsService {
  constructor(
    private db: PrismaService,
    private queue: QueueService,
    private gateway: GatewayService,
    private wallet: WalletService
  ) {}

  async createPayment(userId: string, d: PayDto) {
    // Replaying an idempotency key must return the original payment rather than
    // hitting the unique index and surfacing as an error, so a client that
    // retries after a dropped response converges instead of getting stuck.
    const replay = await this.db.payment.findUnique({ where: { idempotencyKey: d.idempotencyKey } });
    if (replay) return this.assertOwned(replay, userId);

    let payment;
    try {
      payment = await this.createPaymentRecord(userId, d);
    } catch (error) {
      // Two concurrent submits of the same key: the loser re-reads the winner's row.
      if (!isPrismaKnownError(error) || error.code !== 'P2002') throw error;
      const raced = await this.db.payment.findUnique({ where: { idempotencyKey: d.idempotencyKey } });
      if (!raced) throw error;
      payment = this.assertOwned(raced, userId);
    }
    if (payment.status === 'PAID' && payment.bookingId) {
      const booking = await this.db.booking.findUnique({ where: { id: payment.bookingId } });
      if (booking) await this.queue.scheduleBooking(booking.id, booking.startsAt);
    }
    return payment;
  }

  private assertOwned<T extends { userId: string }>(payment: T, userId: string) {
    // An idempotency key is client-chosen, so a guessed key must not disclose or
    // resume another user's payment.
    if (payment.userId !== userId) throw conflict('PAYMENT_KEY_CONFLICT', 'این کلید پرداخت قبلاً استفاده شده است.', 'This payment key has already been used.');
    return payment;
  }

  private async createPaymentRecord(userId: string, d: PayDto) {
    return this.db.$transaction(async tx => {
      let subtotal = 0, bookingId;
      if (d.purpose === 'booking') {
        const booking = await tx.booking.findUnique({ where: { id: d.referenceId } });
        if (!booking || booking.studentId !== userId || booking.status !== 'PENDING_PAYMENT') throw new NotFoundException();
        bookingId = booking.id;
        // Charge the price snapshotted onto the booking, not the teacher's live
        // rate. `booking.price` is the admin-approved price captured at booking
        // time; reading `teacher.trialPrice`/`regularPrice` here both re-quoted
        // the student if the teacher edited their rate in between and used the
        // unapproved draft price. It is also the figure the teacher's earning is
        // computed from on completion, so the two must agree.
        subtotal = booking.price;
        await this.clearBookingPaymentSlot(tx, booking.id);
      } else {
        const pkg = await tx.package.findUnique({ where: { id: d.referenceId, approvalStatus: 'APPROVED' } });
        if (!pkg) throw new NotFoundException();
        subtotal = pkg.price;
      }
      let discountAmount = 0, discountId;
      if (d.discountCode) {
        const discount = await tx.discount.findFirst({
          where: { code: d.discountCode, active: true, OR: [{ startsAt: null }, { startsAt: { lte: new Date() } }], AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }] }] }
        });
        if (!discount) throw new BadRequestException('Discount invalid');
        if (discount.maxUses != null && discount.usedCount >= discount.maxUses) throw new BadRequestException('Discount usage limit reached');
        discountAmount = Math.min(subtotal, discount.type === 'percent' ? Math.round(subtotal * discount.value / 100) : discount.value);
        // Reserve the use now so concurrent checkouts cannot oversell a limited
        // code; `releaseDiscount` gives it back if this payment never completes.
        await tx.discount.update({ where: { id: discount.id }, data: { usedCount: { increment: 1 } } });
        discountId = discount.id;
      }
      const amount = subtotal - discountAmount;
      const balance = await this.wallet.walletBalance(userId, tx);
      if (d.walletAmount < 0 || d.walletAmount > balance || d.walletAmount > amount) throw new BadRequestException('Wallet amount invalid');
      const gatewayAmount = amount - d.walletAmount;
      const payment = await tx.payment.create({
        data: { userId, purpose: d.purpose, referenceId: d.referenceId, bookingId, subtotal, discountAmount, discountId, walletAmount: d.walletAmount, gatewayAmount, amount, status: gatewayAmount === 0 ? 'PAID' : 'PENDING', idempotencyKey: d.idempotencyKey }
      });
      if (d.walletAmount) await this.wallet.ledger(tx, userId, 'DEBIT', d.walletAmount, 'wallet-payment', 'Payment', payment.id, `wallet:${payment.id}`);
      if (gatewayAmount === 0) await this.fulfill(tx, payment.id);
      return payment;
    });
  }

  /**
   * `Payment.bookingId` is unique, so a booking can hold only one payment row.
   * After a failed attempt that row keeps the slot and every retry collides with
   * the unique index, leaving the student unable to pay for a booking that is
   * still PENDING_PAYMENT. The failed attempt is detached instead of deleted:
   * `referenceId` still records which booking it belonged to, so the audit trail
   * (authority, callbackPayload, wallet rollback) survives, while `booking.payment`
   * now resolves to the live attempt — which is what the cancellation refund path
   * in BookingsService expects.
   */
  private async clearBookingPaymentSlot(tx: Tx, bookingId: string) {
    const held = await tx.payment.findUnique({ where: { bookingId } });
    if (!held) return;
    if (held.status !== 'FAILED') {
      throw conflict(
        'BOOKING_PAYMENT_EXISTS',
        'برای این جلسه پرداخت دیگری در جریان است یا تکمیل شده است.',
        'Another payment for this booking is already in progress or completed.',
      );
    }
    await tx.payment.update({ where: { id: held.id }, data: { bookingId: null } });
  }

  async gatewayRedirect(userId: string, paymentId: string) {
    const payment = await this.db.payment.findFirstOrThrow({ where: { id: paymentId, userId, status: 'PENDING' } });
    const result = await this.gateway.request(payment.gatewayAmount, `LingoSpeak ${payment.purpose}`, `${config().API_URL}/api/payments/callback`);
    await this.db.payment.update({ where: { id: payment.id }, data: { authority: result.authority } });
    return result;
  }

  async callback(authority: string, status: string) {
    const payment = await this.db.payment.findUnique({ where: { authority } });
    if (!payment) throw new NotFoundException();
    if (payment.status === 'PAID') return payment;
    if (status !== 'OK') return this.failPayment(payment.id, { authority, status });
    const result = await this.gateway.verify(authority, payment.gatewayAmount);
    if (!result.ok) return this.failPayment(payment.id, { authority, status });
    const paid = await this.db.$transaction(async tx => {
      const current = await tx.payment.findUniqueOrThrow({ where: { id: payment.id } });
      if (current.status === 'PAID') return current;
      const updated = await tx.payment.update({ where: { id: payment.id }, data: { status: 'PAID', gatewayReference: result.reference, verifiedAt: new Date(), callbackPayload: { authority, status } } });
      await this.fulfill(tx, payment.id);
      return updated;
    });
    if (payment.bookingId) {
      const booking = await this.db.booking.findUnique({ where: { id: payment.bookingId } });
      if (booking) await this.queue.scheduleBooking(booking.id, booking.startsAt);
    }
    return paid;
  }

  private async failPayment(paymentId: string, payload: object) {
    return this.db.$transaction(async tx => {
      const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
      if (payment.status !== 'PENDING') return payment;
      if (payment.walletAmount > 0) await this.wallet.ledger(tx, payment.userId, 'CREDIT', payment.walletAmount, 'wallet payment rollback', 'Payment', payment.id, `wallet-rollback:${payment.id}`);
      await releaseDiscount(tx, payment.discountId);
      return tx.payment.update({ where: { id: payment.id }, data: { status: 'FAILED', callbackPayload: payload } });
    });
  }

  private async fulfill(tx: Tx, paymentId: string) {
    const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
    if (payment.purpose === 'booking') {
      await tx.booking.update({ where: { id: payment.referenceId }, data: { status: 'CONFIRMED' } });
      return;
    }
    const pkg = await tx.package.findUniqueOrThrow({ where: { id: payment.referenceId } });
    const enrollment = await tx.enrollment.create({ data: { studentId: payment.userId, packageId: pkg.id, creditsPurchased: pkg.credits, paymentId: payment.id } });
    await tx.creditEntry.create({ data: { enrollmentId: enrollment.id, type: 'PURCHASE', amount: pkg.credits, idempotencyKey: `purchase:${payment.id}` } });
  }
}
