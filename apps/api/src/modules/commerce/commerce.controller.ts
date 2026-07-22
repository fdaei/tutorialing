import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser, Permissions, Public, Roles, type AuthUser } from '../../common/auth';
import { PaymentsService } from './payments.service';
import { WalletService } from './wallet.service';
import { RefundsService } from './refunds.service';
import { PayDto } from './dto/request/pay.dto';
import { RefundDto } from './dto/request/refund.dto';

@Controller('payments')
export class CommerceController {
  constructor(private s: PaymentsService, private walletSvc: WalletService, private refundSvc: RefundsService) {}

  @Post()
  create(@CurrentUser() u: AuthUser, @Body() d: PayDto) {
    return this.s.createPayment(u.id, d);
  }

  @Post(':id/gateway')
  gateway(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.s.gatewayRedirect(u.id, id);
  }

  @Public()
  @Get('callback')
  callback(@Query('Authority') a: string, @Query('Status') status: string) {
    return this.s.callback(a, status);
  }

  @Get('wallet')
  async wallet(@CurrentUser() u: AuthUser) {
    return { balance: await this.walletSvc.walletBalance(u.id) };
  }

  @Roles('ADMIN', 'FINANCE')
  @Permissions('payments.refund')
  @Post(':id/refunds')
  refund(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: RefundDto) {
    return this.refundSvc.refund(u.id, id, d.amount, d.reason, d.idempotencyKey);
  }
}
