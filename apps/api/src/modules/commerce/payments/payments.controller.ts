import { Body, Controller, Get, Headers, Param, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser, PublicRateLimit, RateLimit, RATE_LIMIT_TIERS, Roles, type AuthUser } from '../../../common';
import { config } from '../../../config';
import { PermissionKeys, RequirePermissions } from '../../auth/authorization';
import { PaymentsService } from './payments.service';
import { WalletService } from './wallet.service';
import { RefundsService } from './refunds.service';
import { PayDto, RefundDto, WalletTopUpDto } from '../dto/request/payments.dto';

@Controller('payments')
export class PaymentsController {
  constructor(
    private s: PaymentsService,
    private walletSvc: WalletService,
    private refundSvc: RefundsService,
  ) {}

  @RateLimit(RATE_LIMIT_TIERS.paymentInit)
  @Post()
  create(@CurrentUser() u: AuthUser, @Body() d: PayDto) {
    return this.s.createPayment(u.id, d);
  }

  @RateLimit(RATE_LIMIT_TIERS.paymentInit)
  @Post(':id/gateway')
  gateway(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.s.gatewayRedirect(u.id, id);
  }

  @PublicRateLimit(RATE_LIMIT_TIERS.paymentCallback)
  @Get('callback')
  async callback(
    @Query('Authority') authority: string,
    @Query('Status') status: string,
    @Headers('accept') accept: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const browserRequest = accept?.includes('text/html') ?? false;
    try {
      const payment = await this.s.callback(authority, status);
      if (browserRequest) {
        response.redirect(302, `${config().WEB_URL}/payment/${payment.status === 'PAID' ? 'success' : 'failure'}`);
        return;
      }
      return payment;
    } catch (error) {
      // Payment providers return the customer to this endpoint in their
      // browser. Keep machine clients' original HTTP error, but give a human a
      // useful destination instead of exposing the API error response.
      if (browserRequest) {
        response.redirect(302, `${config().WEB_URL}/payment/failure`);
        return;
      }
      throw error;
    }
  }

  @Get('wallet')
  async wallet(@CurrentUser() u: AuthUser) {
    return { balance: await this.walletSvc.walletBalance(u.id) };
  }

  @RateLimit(RATE_LIMIT_TIERS.paymentInit)
  @Post('wallet/top-up')
  topUp(@CurrentUser() u: AuthUser, @Body() d: WalletTopUpDto) {
    return this.s.createWalletTopUp(u.id, d.amount, d.idempotencyKey);
  }

  @Get('wallet/transactions')
  transactions(@CurrentUser() u: AuthUser) {
    return this.walletSvc.transactions(u.id);
  }

  @Get('invoices')
  invoices(@CurrentUser() u: AuthUser) {
    return this.walletSvc.invoices(u.id);
  }

  @Roles('ADMIN', 'SUPPORT')
  @RequirePermissions(PermissionKeys.Payments.Refund)
  @RateLimit(RATE_LIMIT_TIERS.moneyAdjacent)
  @Post(':id/refunds')
  refund(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: RefundDto) {
    return this.refundSvc.refund(u.id, id, d.amount, d.reason, d.idempotencyKey);
  }
}
