import { Body, Controller, Get, Post } from '@nestjs/common';
import { CurrentUser, Roles, type AuthUser } from '../../common/auth';
import { PayoutsService } from './payouts.service';
import { WithdrawalRequestDto } from './dto/request/withdrawal-request.dto';

@Roles('TEACHER')
@Controller('teacher/finance')
export class TeacherFinanceController {
  constructor(private s: PayoutsService) {}

  @Get()
  summary(@CurrentUser() u: AuthUser) {
    return this.s.teacherFinance(u.id);
  }

  @Post('withdrawals')
  withdraw(@CurrentUser() u: AuthUser, @Body() body: WithdrawalRequestDto) {
    return this.s.requestWithdrawal(u.id, body.amount, body.iban);
  }
}
