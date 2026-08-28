import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ReviewStatus } from '@prisma/client';
import { CurrentUser, Roles, type AuthUser } from '../../common';
import { PermissionKeys, RequirePermissions } from '../auth/authorization';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/request/create-review.dto';
import { ModerateReviewDto } from './dto/request/moderate-review.dto';
import { ReplyReviewDto } from './dto/request/reply-review.dto';
import { UpdateReviewDto } from './dto/request/update-review.dto';
import { ApiTags } from '@nestjs/swagger';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly service: ReviewsService) {}
  @Post() create(@CurrentUser() user: AuthUser, @Body() body: CreateReviewDto) {
    return this.service.create(user.id, body.bookingId, body.rating, body.comment);
  }
  @Get('teacher/:teacherId/eligibility') eligibility(
    @CurrentUser() user: AuthUser,
    @Param('teacherId') teacherId: string,
  ) {
    return this.service.eligibility(user.id, teacherId);
  }
  @Patch(':id') update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: UpdateReviewDto) {
    return this.service.update(user.id, id, body.rating, body.comment);
  }
  @Delete(':id') remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(user.id, id);
  }
  @Roles('TEACHER') @Post(':id/reply') reply(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: ReplyReviewDto,
  ) {
    return this.service.reply(user.id, id, body.response);
  }
}

@Roles('ADMIN', 'STAFF')
@RequirePermissions(PermissionKeys.Reviews.Manage)
@Controller('admin/reviews')
@ApiTags('admin')
export class AdminReviewsController {
  constructor(private readonly service: ReviewsService) {}
  @Get() list(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('status') status?: ReviewStatus,
    @Query('search') search = '',
  ) {
    return this.service.adminList(Math.max(1, Number(page)), Math.min(100, Math.max(1, Number(limit))), status, search);
  }
  @Post(':id/moderate') moderate(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: ModerateReviewDto,
  ) {
    return this.service.moderate(user.id, id, body.status, body.note);
  }
}
