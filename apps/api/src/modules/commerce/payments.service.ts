import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService, Tx } from '../../prisma.service';
import { config } from '../../config';
import { QueueService } from '../queue/queue.service';
import { GatewayService } from './gateway.service';
import { WalletService } from './wallet.service';
import { PayDto } from './dto/request/pay.dto';

@Injectable()
export class PaymentsService {
  constructor(
    private db: PrismaService,
    private queue: QueueService,
    private gateway: GatewayService,
    private wallet: WalletService
  ) {}

  async createPayment(userId: string, d: PayDto) {
    const payment = await this.db.$transaction(async tx => {
      let subtotal = 0, bookingId;
      if (d.purpose === 'booking') {
        const booking = await tx.booking.findUnique({ where: { id: d.referenceId }, include: { teacher: true } });
        if (!booking || booking.studentId !== userId || booking.status !== 'PENDING_PAYMENT') throw new NotFoundException();
        bookingId = booking.id;
        subtotal = booking.type === 'trial' ? booking.teacher.trialPrice : booking.teacher.regularPrice;
      } else {
        const pkg = await tx.package.findUnique({ where: { id: d.referenceId, approvalStatus: 'APPROVED' } });
        if (!pkg) throw new NotFoundException();
        subtotal = pkg.price;
      }
      let discountAmount = 0;
      if (d.discountCode) {
        const discount = await tx.discount.findFirst({
          where: { code: d.discountCode, active: true, OR: [{ startsAt: null }, { startsAt: { lte: new Date() } }], AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }] }] }
        });
        if (!discount) throw new BadRequestException('Discount invalid');
        if (discount.maxUses != null && discount.usedCount >= discount.maxUses) throw new BadRequestException('Discount usage limit reached');
        discountAmount = Math.min(subtotal, discount.type === 'percent' ? Math.round(subtotal * discount.value / 100) : discount.value);
        await tx.discount.update({ where: { id: discount.id }, data: { usedCount: { increment: 1 } } });
      }
      const amount = subtotal - discountAmount;
      const balance = await this.wallet.walletBalance(userId, tx);
      if (d.walletAmount < 0 || d.walletAmount > balance || d.walletAmount > amount) throw new BadRequestException('Wallet amount invalid');
      const gatewayAmount = amount - d.walletAmount;
      const payment = await tx.payment.create({
        data: { userId, purpose: d.purpose, referenceId: d.referenceId, bookingId, subtotal, discountAmount, walletAmount: d.walletAmount, gatewayAmount, amount, status: gatewayAmount === 0 ? 'PAID' : 'PENDING', idempotencyKey: d.idempotencyKey }
      });
      if (d.walletAmount) await this.wallet.ledger(tx, userId, 'DEBIT', d.walletAmount, 'wallet-payment', 'Payment', payment.id, `wallet:${payment.id}`);
      if (gatewayAmount === 0) await this.fulfill(tx, payment.id);
      return payment;
    });
    if (payment.status === 'PAID' && payment.bookingId) {
      const booking = await this.db.booking.findUnique({ where: { id: payment.bookingId } });
      if (booking) await this.queue.scheduleBooking(booking.id, booking.startsAt);
    }
    return payment;
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
