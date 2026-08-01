import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma, type Payment, type PaymentStatus } from '@prisma/client';
import { PrismaService, Tx } from '../../prisma.service';
import { RedisService } from '../../common/redis.service';
import { badRequest, conflict, isPrismaKnownError } from '../../common/errors';
import { config } from '../../config';
import { QueueService } from '../queue/queue.service';
import { GatewayService } from './gateway.service';
import { WalletService } from './wallet.service';
import { PayDto } from './dto/request/pay.dto';
import { releaseDiscount } from './discount-reservation';
import { AutoDiscountsService } from './auto-discounts.service';

@Injectable()
export class PaymentsService {
  constructor(
    private db: PrismaService,
    private queue: QueueService,
    private gateway: GatewayService,
    private wallet: WalletService,
    private autoDiscounts: AutoDiscountsService,
    private redis: RedisService,
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
      let discountAmount = 0, discountId, discountRuleId;
      let codeDiscount: { id: string; amount: number } | undefined;
      if (d.discountCode) {
        const discount = await tx.discount.findFirst({
          where: { code: d.discountCode, active: true, OR: [{ startsAt: null }, { startsAt: { lte: new Date() } }], AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }] }] }
        });
        if (!discount) throw badRequest('DISCOUNT_INVALID', 'کد تخفیف معتبر نیست یا منقضی شده است.', 'The discount code is invalid or has expired.', {
          discountCode: { fa: 'کد را بررسی کنید یا بدون کد ادامه دهید.', en: 'Check the code or continue without one.' },
        });
        if (discount.maxUses != null && discount.usedCount >= discount.maxUses) throw badRequest('DISCOUNT_LIMIT_REACHED', 'ظرفیت استفاده از این کد تخفیف تکمیل شده است.', 'This discount code has reached its usage limit.', {
          discountCode: { fa: 'کد دیگری وارد کنید یا بدون کد ادامه دهید.', en: 'Try another code or continue without one.' },
        });
        codeDiscount = { id: discount.id, amount: Math.min(subtotal, discount.type === 'percent' ? Math.round(subtotal * discount.value / 100) : discount.value) };
      }
      // Automatic rules (currently the birthday discount) are evaluated even when
      // a code was supplied, and the student keeps whichever is worth more. They
      // never stack: `Payment` records exactly one of the two.
      const autoDiscount = await this.autoDiscounts.evaluate(tx, userId, subtotal);
      if (autoDiscount && autoDiscount.amount > (codeDiscount?.amount ?? 0)) {
        discountAmount = autoDiscount.amount;
        discountRuleId = autoDiscount.ruleId;
      } else if (codeDiscount) {
        discountAmount = codeDiscount.amount;
        discountId = codeDiscount.id;
        // Reserve the use now so concurrent checkouts cannot oversell a limited
        // code; `releaseDiscount` gives it back if this payment never completes.
        await tx.discount.update({ where: { id: codeDiscount.id }, data: { usedCount: { increment: 1 } } });
      }
      const amount = subtotal - discountAmount;
      const balance = await this.wallet.walletBalance(userId, tx);
      if (d.walletAmount < 0 || d.walletAmount > balance || d.walletAmount > amount) throw badRequest(
        'WALLET_AMOUNT_INVALID',
        'مبلغ انتخاب‌شده از کیف پول بیشتر از موجودی یا مبلغ قابل پرداخت است.',
        'The selected wallet amount exceeds your balance or the payable amount.',
        { walletAmount: { fa: `حداکثر مبلغ قابل استفاده از کیف پول ${Math.min(balance, amount)} است.`, en: `At most ${Math.min(balance, amount)} can be paid from the wallet.` } },
      );
      const gatewayAmount = amount - d.walletAmount;
      const payment = await tx.payment.create({
        data: { userId, purpose: d.purpose, referenceId: d.referenceId, bookingId, subtotal, discountAmount, discountId, discountRuleId, walletAmount: d.walletAmount, gatewayAmount, amount, status: gatewayAmount === 0 ? 'PAID' : 'PENDING', idempotencyKey: d.idempotencyKey }
      });
      if (d.walletAmount) {
        await this.wallet.ledger(tx, userId, 'DEBIT', d.walletAmount, 'wallet-payment', 'Payment', payment.id, `wallet:${payment.id}`);
        // The balance read above and the debit below are two statements, so two
        // concurrent checkouts could both see the same funds and both spend
        // them. Serializable isolation makes the pair conflict, and this
        // re-read is the backstop that refuses to leave the ledger negative
        // even if the isolation level is ever weakened.
        const settled = await this.wallet.walletBalance(userId, tx);
        if (settled < 0) throw conflict(
          'WALLET_BALANCE_CONFLICT',
          'موجودی کیف پول شما هم‌زمان در پرداخت دیگری استفاده شد. صفحه را دوباره بارگذاری کنید.',
          'Your wallet balance was spent by another payment at the same time. Reload and try again.',
        );
      }
      if (gatewayAmount === 0) await this.fulfill(tx, payment.id, 'PENDING');
      return payment;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
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

  // Locked per-payment: without this, two concurrent calls (double-click,
  // network retry) each request a fresh Zarinpal authority and the second
  // `payment.update` silently overwrites the first, orphaning a Zarinpal
  // session that may still be the one the user actually completes.
  async gatewayRedirect(userId: string, paymentId: string) {
    const lock = await this.redis.lock(`payment-gateway:${paymentId}`);
    if (!lock) throw conflict(
      'PAYMENT_GATEWAY_BUSY',
      'درخواست پرداخت قبلی هنوز در حال پردازش است. لطفاً چند لحظه صبر کنید.',
      'A previous payment request is still being processed. Please wait a moment and try again.',
    );
    try {
      const payment = await this.db.payment.findFirstOrThrow({ where: { id: paymentId, userId, status: 'PENDING' } });
      if (payment.authority) return { authority: payment.authority, url: this.gateway.resumeUrl(payment.authority) };
      const result = await this.gateway.request(payment.gatewayAmount, `LingoSpeak ${payment.purpose}`, `${config().API_URL}/api/payments/callback`);
      await this.db.payment.update({ where: { id: payment.id }, data: { authority: result.authority } });
      return result;
    } finally {
      await lock.release();
    }
  }

  /**
   * Statuses a gateway callback is still allowed to settle. PENDING is the
   * normal case. EXPIRED and FAILED are settled too, because the gateway may
   * have captured the money before the callback reached us and that capture has
   * to be accounted for — `fulfill` returns it rather than handing out the
   * class. Anything already REFUNDED must be left alone: re-verifying it would
   * credit an amount that has already gone back to the student.
   */
  private static readonly SETTLEABLE: PaymentStatus[] = ['PENDING', 'EXPIRED', 'FAILED'];

  async callback(authority: string, status: string) {
    const payment = await this.db.payment.findUnique({ where: { authority } });
    if (!payment) throw new NotFoundException();
    if (payment.status === 'PAID') return payment;
    if (!PaymentsService.SETTLEABLE.includes(payment.status)) return payment;
    if (status !== 'OK') return this.failPayment(payment.id, { authority, status });
    const result = await this.gateway.verify(authority, payment.gatewayAmount);
    if (!result.ok) return this.failPayment(payment.id, { authority, status });
    const paid = await this.db.$transaction(async tx => {
      const current = await tx.payment.findUniqueOrThrow({ where: { id: payment.id } });
      if (current.status === 'PAID') return current;
      await tx.payment.update({ where: { id: payment.id }, data: { status: 'PAID', gatewayReference: result.reference, verifiedAt: new Date(), callbackPayload: { authority, status } } });
      await this.fulfill(tx, payment.id, current.status);
      // `fulfill` can move the payment straight on to REFUNDED, so the row is
      // re-read rather than returning the pre-fulfil update result.
      return tx.payment.findUniqueOrThrow({ where: { id: payment.id } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    // Only a booking that this callback actually confirmed gets reminders.
    if (paid.status === 'PAID' && paid.bookingId) {
      const booking = await this.db.booking.findUnique({ where: { id: paid.bookingId } });
      if (booking?.status === 'CONFIRMED') await this.queue.scheduleBooking(booking.id, booking.startsAt);
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

  private async fulfill(tx: Tx, paymentId: string, previousStatus: PaymentStatus) {
    const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
    if (payment.purpose === 'booking') {
      const booking = await tx.booking.findUnique({ where: { id: payment.referenceId } });
      // A gateway callback can land after the 15-minute payment window closed
      // and the expiry job cancelled the booking — by which time the slot may
      // already have been resold to another student. Confirming it here
      // double-booked the teacher and, because expiry had already returned the
      // wallet portion, also let the student keep both the refund and the class.
      // The capture is kept on the record for the audit trail and returned to
      // the student's wallet instead of claiming a slot we no longer hold.
      if (!booking || booking.status !== 'PENDING_PAYMENT') {
        await this.returnCapture(tx, payment, previousStatus, 'booking_no_longer_available');
        return;
      }
      await tx.booking.update({ where: { id: booking.id }, data: { status: 'CONFIRMED' } });
      return;
    }
    const pkg = await tx.package.findUniqueOrThrow({ where: { id: payment.referenceId } });
    const enrollment = await tx.enrollment.create({ data: { studentId: payment.userId, packageId: pkg.id, creditsPurchased: pkg.credits, paymentId: payment.id } });
    await tx.creditEntry.create({ data: { enrollmentId: enrollment.id, type: 'PURCHASE', amount: pkg.credits, idempotencyKey: `purchase:${payment.id}` } });
  }

  /**
   * Returns money the gateway captured for something we can no longer deliver.
   *
   * The gateway portion was captured seconds ago and has never been given back,
   * so it is always returned. The wallet portion is different: the expiry job
   * and `failPayment` both credit it back when they run, so it is only added
   * when no credit yet references this payment. The discount reservation is
   * likewise only released when this payment had not already reached a terminal
   * status that released it.
   */
  private async returnCapture(tx: Tx, payment: Payment, previousStatus: PaymentStatus, reason: string) {
    const walletReturned = payment.walletAmount > 0
      ? await tx.walletEntry.count({ where: { userId: payment.userId, referenceType: 'Payment', referenceId: payment.id, direction: 'CREDIT' } })
      : 0;
    const amount = payment.gatewayAmount + (walletReturned ? 0 : payment.walletAmount);
    const refund = await tx.refund.upsert({
      where: { idempotencyKey: `late-capture:${payment.id}` },
      create: { paymentId: payment.id, amount, reason, status: 'completed', idempotencyKey: `late-capture:${payment.id}` },
      update: {},
    });
    if (amount > 0) await tx.walletEntry.upsert({
      where: { idempotencyKey: `late-capture-ledger:${refund.id}` },
      create: { userId: payment.userId, transactionId: `tx_${refund.id}`, account: 'user_wallet', direction: 'CREDIT', amount, description: `late gateway capture returned: ${reason}`, referenceType: 'Refund', referenceId: refund.id, idempotencyKey: `late-capture-ledger:${refund.id}` },
      update: {},
    });
    if (previousStatus === 'PENDING') await releaseDiscount(tx, payment.discountId);
    await tx.payment.update({ where: { id: payment.id }, data: { status: 'REFUNDED' } });
    await tx.notification.create({
      data: {
        userId: payment.userId,
        type: 'PAYMENT_RETURNED_TO_WALLET',
        titleFa: 'مبلغ پرداختی به کیف پول شما برگشت',
        titleEn: 'Your payment was returned to your wallet',
        bodyFa: 'زمان پرداخت این رزرو به پایان رسیده بود و نوبت آزاد شد. مبلغ پرداخت‌شده به کیف پول شما بازگشت و می‌توانید نوبت دیگری رزرو کنید.',
        bodyEn: 'The payment window for this booking had closed and the slot was released. The amount has been returned to your wallet and you can book another slot.',
        data: { paymentId: payment.id, refundId: refund.id, amount, reason },
      },
    });
  }
}
