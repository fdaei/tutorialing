import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser, Roles, type AuthUser } from '../../common/auth';
import { LearningService } from './learning.service';
import { EvaluationDto } from './dto/request/evaluation.dto';
import { PlanDto } from './dto/request/plan.dto';
import { AssignmentDto } from './dto/request/assignment.dto';

@Controller('learning')
export class LearningController {
  constructor(private s: LearningService) {}

  @Get('plans')
  plans(@CurrentUser() u: AuthUser) {
    return this.s.plans(u.id, u.roles.includes('TEACHER'));
  }

  @Roles('TEACHER')
  @Post('trial-evaluations')
  evaluate(@CurrentUser() u: AuthUser, @Body() d: EvaluationDto) {
    return this.s.evaluate(u.id, d);
  }

  @Roles('TEACHER')
  @Post('plans')
  plan(@CurrentUser() u: AuthUser, @Body() d: PlanDto) {
    return this.s.createPlan(u.id, d);
  }

  @Roles('TEACHER')
  @Post('plans/:id/assignments')
  assignment(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: AssignmentDto) {
    return this.s.assignment(u.id, id, d);
  }

  @Post('assignments/:id/submit')
  submit(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: { submission: string }) {
    return this.s.submit(u.id, id, d.submission);
  }
}
