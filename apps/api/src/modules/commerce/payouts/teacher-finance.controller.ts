import { Body, Controller, Get, Post } from '@nestjs/common';
import { CurrentUser, RateLimit, RATE_LIMIT_TIERS, Roles, type AuthUser } from '../../../common/auth';
import { PayoutsService } from './payouts.service';
import { WithdrawalRequestDto } from '../dto/request/payouts.dto';

@Roles('TEACHER')
@Controller('teacher/finance')
export class TeacherFinanceController {
  constructor(private s: PayoutsService) {}

  @Get()
  summary(@CurrentUser() u: AuthUser) {
    return this.s.teacherFinance(u.id);
  }

  @RateLimit(RATE_LIMIT_TIERS.moneyAdjacent)
  @Post('withdrawals')
  withdraw(@CurrentUser() u: AuthUser, @Body() body: WithdrawalRequestDto) {
    return this.s.requestWithdrawal(u.id, body.amount, body.iban, body.idempotencyKey);
  }
}
