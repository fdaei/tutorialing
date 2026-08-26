import { Module } from '@nestjs/common';

import { PaymentsController } from './payments/payments.controller';
import { PaymentsService } from './payments/payments.service';
import { GatewayService } from './payments/gateway.service';
import { WalletService } from './payments/wallet.service';
import { RefundsService } from './payments/refunds.service';
import { ReconciliationService } from './payments/reconciliation.service';

import { PayoutsController } from './payouts/payouts.controller';
import { TeacherFinanceController } from './payouts/teacher-finance.controller';
import { PayoutsService } from './payouts/payouts.service';
import { EarningsService } from './payouts/earnings.service';

import { DiscountsService } from './discounts/discounts.service';
import { AutoDiscountsService } from './discounts/auto-discounts.service';

import { PackagesController } from './packages/packages.controller';
import { PackagesService } from './packages/packages.service';
import { AdminCommerceController } from './admin-commerce.controller';
import { AdminCommerceService } from './admin-commerce.service';

/**
 * Money. Grouped into four concerns that map onto the sub-folders:
 * `payments/` (checkout, gateway, wallet, refunds, reconciliation),
 * `payouts/` (teacher earnings and withdrawals), `discounts/` (codes and
 * automatic rules) and `packages/` (sellable session bundles).
 */
@Module({
  controllers: [PaymentsController, PackagesController, PayoutsController, TeacherFinanceController, AdminCommerceController],
  providers: [
    PaymentsService,
    GatewayService,
    WalletService,
    RefundsService,
    ReconciliationService,
    PayoutsService,
    EarningsService,
    DiscountsService,
    AutoDiscountsService,
    PackagesService,
    AdminCommerceService,
  ],
  exports: [
    PaymentsService,
    WalletService,
    RefundsService,
    ReconciliationService,
    PayoutsService,
    EarningsService,
    DiscountsService,
    AutoDiscountsService,
    PackagesService,
  ],
})
export class CommerceModule {}
