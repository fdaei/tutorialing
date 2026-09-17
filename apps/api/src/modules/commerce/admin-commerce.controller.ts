import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser, RateLimit, RATE_LIMIT_TIERS, Roles, type AuthUser } from '../../common';
import { PermissionKeys, RequirePermissions } from '../auth/authorization';
import { AdminCommerceService } from './admin-commerce.service';
import { ApiTags } from '@nestjs/swagger';
import { ReceiptApproveDto, ReceiptRejectDto, WalletAdjustmentDto } from './dto/request/payments.dto';
import { ReceiptTopUpsService } from './payments/receipt-top-ups.service';

@Roles('ADMIN', 'SUPPORT')
@ApiTags('admin')
@Controller('admin')
export class AdminCommerceController {
  constructor(
    private readonly commerce: AdminCommerceService,
    private readonly receipts: ReceiptTopUpsService,
  ) {}
  @RequirePermissions(PermissionKeys.Reports.Read) @Get('reports') reports() { return this.commerce.reports(); }
  @RequirePermissions(PermissionKeys.Payments.Read) @Get('payments') payments() { return this.commerce.payments(); }
  @RequirePermissions(PermissionKeys.Payments.Read) @Get('users/:userId/invoices') userInvoices(@Param('userId') userId: string) { return this.commerce.userInvoices(userId); }
  @RequirePermissions(PermissionKeys.Payments.AdjustWallet)
  @RateLimit(RATE_LIMIT_TIERS.moneyAdjacent)
  @Post('payments/:id/receipt/approve')
  approveReceipt(@CurrentUser() actor: AuthUser, @Param('id') id: string, @Body() body: ReceiptApproveDto) {
    return this.receipts.approve(actor.id, id, body.reference);
  }
  @RequirePermissions(PermissionKeys.Payments.AdjustWallet)
  @RateLimit(RATE_LIMIT_TIERS.moneyAdjacent)
  @Post('payments/:id/receipt/reject')
  rejectReceipt(@CurrentUser() actor: AuthUser, @Param('id') id: string, @Body() body: ReceiptRejectDto) {
    return this.receipts.reject(actor.id, id, body.reason);
  }
  @RequirePermissions(PermissionKeys.Payments.Read) @Get('wallets') wallets() { return this.commerce.wallets(); }
  @RequirePermissions(PermissionKeys.Payments.AdjustWallet)
  @RateLimit(RATE_LIMIT_TIERS.moneyAdjacent)
  @Post('wallets/:userId/adjustments')
  adjustWallet(@CurrentUser() actor: AuthUser, @Param('userId') userId: string, @Body() body: WalletAdjustmentDto) {
    return this.commerce.adjustWallet(actor.id, userId, body);
  }
}
