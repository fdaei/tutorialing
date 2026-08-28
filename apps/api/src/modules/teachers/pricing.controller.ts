import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { PriceStatus } from '@prisma/client';
import { CurrentUser, Roles, type AuthUser } from '../../common';
import { PermissionKeys, RequirePermissions } from '../auth/authorization';
import { PricingService } from './pricing.service';
import { PriceReviewDto } from './dto/request/price-review.dto';
import { ApiTags } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

class NegotiationDto {
  @IsString() @Length(3, 1000) note!: string;
}

@Roles('TEACHER')
@Controller('teacher/pricing')
export class TeacherPricingController {
  constructor(private readonly service: PricingService) {}
  @Get() mine(@CurrentUser() user: AuthUser) {
    return this.service.mine(user.id);
  }
  @Post('accept-counter') acceptCounter(@CurrentUser() user: AuthUser) {
    return this.service.acceptCounter(user.id);
  }
  @Post('request-negotiation') requestNegotiation(@CurrentUser() user: AuthUser, @Body() body: NegotiationDto) {
    return this.service.requestNegotiation(user.id, body.note);
  }
}

@Roles('ADMIN', 'STAFF', 'FINANCE')
@RequirePermissions(PermissionKeys.TeacherPrices.Manage)
@Controller('admin/teacher-prices')
@ApiTags('admin')
export class AdminPricingController {
  constructor(private readonly service: PricingService) {}
  @Get() list(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('status') status?: PriceStatus,
    @Query('search') search = '',
  ) {
    return this.service.adminList(Math.max(1, Number(page)), Math.min(100, Math.max(1, Number(limit))), status, search);
  }
  @Post(':id/review') review(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: PriceReviewDto) {
    return this.service.review(user.id, user.roles, id, body);
  }
}
