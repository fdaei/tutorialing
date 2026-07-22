import{Module}from'@nestjs/common';import{CommerceController}from'./commerce.controller';
import{PackagesController}from'./packages.controller';
import{PayoutsController}from'./payouts.controller';
import{TeacherFinanceController}from'./teacher-finance.controller';import{PaymentsService}from'./payments.service';
import{PackagesService}from'./packages.service';
import{WalletService}from'./wallet.service';
import{PayoutsService}from'./payouts.service';
import{DiscountsService}from'./discounts.service';
import{RefundsService}from'./refunds.service';import{GatewayService}from'./gateway.service';@Module({controllers:[CommerceController,PackagesController,PayoutsController,TeacherFinanceController],providers:[PaymentsService,PackagesService,WalletService,PayoutsService,DiscountsService,RefundsService,GatewayService],exports:[PaymentsService,PackagesService,WalletService,PayoutsService,DiscountsService,RefundsService]})export class CommerceModule{}
