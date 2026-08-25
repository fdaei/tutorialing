import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
<<<<<<< Updated upstream:apps/api/src/modules/commerce/payments/payments.controller.ts
import { CurrentUser, Permissions, Public, RateLimit, RATE_LIMIT_TIERS, Roles, type AuthUser } from '../../../common';
||||||| Stash base:apps/api/src/modules/commerce/commerce.controller.ts
import { CurrentUser, Permissions, Public, RateLimit, RATE_LIMIT_TIERS, Roles, type AuthUser } from '../../common/auth';
=======
import { Authorize, CurrentUser, PublicRateLimit, RateLimit, RATE_LIMIT_TIERS, type AuthUser } from '../../common/auth';
>>>>>>> Stashed changes:apps/api/src/modules/commerce/commerce.controller.ts
import { PaymentsService } from './payments.service';
import { WalletService } from './wallet.service';
import { RefundsService } from './refunds.service';
import { PayDto, RefundDto } from '../dto/request/payments.dto';

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
  callback(@Query('Authority') a: string, @Query('Status') status: string) {
    return this.s.callback(a, status);
  }

  @Get('wallet')
  async wallet(@CurrentUser() u: AuthUser) {
    return { balance: await this.walletSvc.walletBalance(u.id) };
  }

  @Get('wallet/transactions')
  transactions(@CurrentUser() u: AuthUser) {
    return this.walletSvc.transactions(u.id);
  }

  @Get('invoices')
  invoices(@CurrentUser() u: AuthUser) {
    return this.walletSvc.invoices(u.id);
  }

  @Authorize(['ADMIN', 'FINANCE'], ['payments.refund'])
  @RateLimit(RATE_LIMIT_TIERS.moneyAdjacent)
  @Post(':id/refunds')
  refund(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: RefundDto) {
    return this.refundSvc.refund(u.id, id, d.amount, d.reason, d.idempotencyKey);
  }
}
