import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PriceStatus } from '@prisma/client';
import { CurrentUser, Permissions, Roles, type AuthUser } from '../../common/auth';
import { PricingService } from './pricing.service';

class ProposalDto {
  @IsInt() @Min(10000) proposedTrialPrice!: number;
  @IsInt() @Min(10000) proposedRegularPrice!: number;
}
class PriceReviewDto {
  @IsIn(['start_review', 'counter', 'reject', 'recommend_approval', 'approve']) action!: 'start_review' | 'counter' | 'reject' | 'recommend_approval' | 'approve';
  @IsOptional() @IsInt() @Min(10000) counterTrialPrice?: number;
  @IsOptional() @IsInt() @Min(10000) counterRegularPrice?: number;
  @IsOptional() @IsString() note?: string;
}

@Roles('TEACHER')
@Controller('teacher/pricing')
export class TeacherPricingController {
  constructor(private readonly service: PricingService) {}
  @Get() mine(@CurrentUser() user: AuthUser) { return this.service.mine(user.id); }
  @Post('propose') propose(@CurrentUser() user: AuthUser, @Body() body: ProposalDto) { return this.service.propose(user.id, body.proposedTrialPrice, body.proposedRegularPrice); }
  @Post('accept-counter') acceptCounter(@CurrentUser() user: AuthUser) { return this.service.acceptCounter(user.id); }
}

@Roles('ADMIN', 'STAFF', 'FINANCE')
@Permissions('teacher-prices.manage')
@Controller('admin/teacher-prices')
export class AdminPricingController {
  constructor(private readonly service: PricingService) {}
  @Get() list(@Query('page') page = '1', @Query('limit') limit = '20', @Query('status') status?: PriceStatus, @Query('search') search = '') {
    return this.service.adminList(Math.max(1, Number(page)), Math.min(100, Math.max(1, Number(limit))), status, search);
  }
  @Post(':id/review') review(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: PriceReviewDto) {
    return this.service.review(user.id, user.roles, id, body);
  }
}
