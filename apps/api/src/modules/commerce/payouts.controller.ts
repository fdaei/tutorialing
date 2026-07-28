import { DiscountDto } from './dto/request/discount.dto';
import { PayoutWindowDto } from './dto/request/payout-window.dto';
import { PayoutApprovalDto } from './dto/request/payout-approval.dto';
import { Body, Controller, Param, Post } from '@nestjs/common';
import { CurrentUser, Permissions, Roles, type AuthUser } from '../../common/auth';
import { PayoutsService } from './payouts.service';
import { DiscountsService } from './discounts.service';

@Roles('ADMIN', 'FINANCE')
@Permissions('payouts.manage')
@Controller('payouts')
export class PayoutsController {
  constructor(private s: PayoutsService, private discountSvc: DiscountsService) {}

  @Post('generate')
  generate(@Body() d: PayoutWindowDto) {
    return this.s.generatePayout(new Date(d.weekStart), new Date(d.weekEnd));
  }

  @Post(':id/approve')
  approve(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: PayoutApprovalDto) {
    return this.s.approvePayout(id, u.id, d.reference);
  }

  @Post('discounts')
  discount(@Body() d: DiscountDto) {
    return this.discountSvc.createDiscount(d);
  }
}
