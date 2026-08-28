import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CurrentUser, Public, RateLimit, RATE_LIMIT_TIERS, type AuthUser } from '../../common';
import { PlacementSubmitDto } from './dto/request/placement-submit.dto';
import { PlacementService } from './placement.service';

@Controller('placement')
export class PlacementController {
  constructor(private placement: PlacementService) {}

  @Public() @Get('tests')
  tests(@Query('languageId') languageId?: string) { return this.placement.tests(languageId); }

  @Public() @Get('questions')
  questions(@Query('testId') testId: string) { return this.placement.questions(testId); }

  @Public() @RateLimit(RATE_LIMIT_TIERS.examSubmission) @Post('guest/submit')
  guestSubmit(@Body() body: PlacementSubmitDto) { return this.placement.submit(null, body.testId, body.answers); }

  @RateLimit(RATE_LIMIT_TIERS.examSubmission) @Post('submit')
  submit(@CurrentUser() user: AuthUser, @Body() body: PlacementSubmitDto) { return this.placement.submit(user.id, body.testId, body.answers); }

  @Get('history')
  history(@CurrentUser() user: AuthUser) { return this.placement.history(user.id); }
}
