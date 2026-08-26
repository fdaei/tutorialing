import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser, RateLimit, RATE_LIMIT_TIERS, Roles, type AuthUser } from '../../../common';
import { PermissionKeys, RequirePermissions } from '../../auth/authorization';
import { PayoutsService } from './payouts.service';
import { DiscountsService } from '../discounts/discounts.service';
import { DiscountDto, PayoutApprovalDto, PayoutWindowDto } from '../dto/request/payouts.dto';

@Roles('ADMIN', 'FINANCE')
@RequirePermissions(PermissionKeys.Payouts.Manage)
@RateLimit(RATE_LIMIT_TIERS.moneyAdjacent)
@Controller('payouts')
export class PayoutsController {
  constructor(
    private s: PayoutsService,
    private discountSvc: DiscountsService,
  ) {}

  @Post('generate')
  generate(@Body() d: PayoutWindowDto) {
    return this.s.generatePayout(new Date(d.weekStart), new Date(d.weekEnd));
  }

  @Post(':id/approve')
  approve(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: PayoutApprovalDto) {
    return this.s.approvePayout(id, u.id, d.reference);
  }

  @Get('withdrawals')
  withdrawals() {
    return this.s.withdrawalRequests();
  }

  @Post('withdrawals/:id/transfer')
  transferWithdrawal(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: PayoutApprovalDto) {
    return this.s.transferWithdrawal(id, u.id, d.reference);
  }

  @Post('discounts')
  discount(@Body() d: DiscountDto) {
    return this.discountSvc.createDiscount(d);
  }
}
