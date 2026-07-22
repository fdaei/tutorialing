import { Body, Controller, Get, Post } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../../common/auth';
import { MatchingService } from './matching.service';
import { MatchDto } from './dto/request/match.dto';

@Controller('matching')
export class MatchingController {
  constructor(private s: MatchingService) {}

  @Post()
  create(@CurrentUser() u: AuthUser, @Body() d: MatchDto) {
    return this.s.create(u.id, d);
  }

  @Get('history')
  history(@CurrentUser() u: AuthUser) {
    return this.s.history(u.id);
  }
}
