import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser, RateLimit, RATE_LIMIT_TIERS, Roles, type AuthUser } from '../../common';
import { PermissionKeys, RequirePermissions } from '../auth/authorization';
import { AdminCommerceService } from './admin-commerce.service';
import { ApiTags } from '@nestjs/swagger';
import { WalletAdjustmentDto } from './dto/request/payments.dto';

@Roles('ADMIN', 'STAFF', 'FINANCE')
@ApiTags('admin')
@Controller('admin')
export class AdminCommerceController {
  constructor(private readonly commerce: AdminCommerceService) {}
  @RequirePermissions(PermissionKeys.Reports.Read) @Get('reports') reports() { return this.commerce.reports(); }
  @RequirePermissions(PermissionKeys.Payments.Read) @Get('payments') payments() { return this.commerce.payments(); }
  @RequirePermissions(PermissionKeys.Payments.Read) @Get('wallets') wallets() { return this.commerce.wallets(); }
  @RequirePermissions(PermissionKeys.Payments.AdjustWallet)
  @RateLimit(RATE_LIMIT_TIERS.moneyAdjacent)
  @Post('wallets/:userId/adjustments')
  adjustWallet(@CurrentUser() actor: AuthUser, @Param('userId') userId: string, @Body() body: WalletAdjustmentDto) {
    return this.commerce.adjustWallet(actor.id, userId, body);
  }
}
