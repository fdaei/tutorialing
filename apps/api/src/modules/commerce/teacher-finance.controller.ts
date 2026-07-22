import { Controller, Get } from '@nestjs/common';
import { CurrentUser, Roles, type AuthUser } from '../../common/auth';
import { PayoutsService } from './payouts.service';

@Roles('TEACHER')
@Controller('teacher/finance')
export class TeacherFinanceController {
  constructor(private s: PayoutsService) {}

  @Get()
  summary(@CurrentUser() u: AuthUser) {
    return this.s.teacherFinance(u.id);
  }
}
