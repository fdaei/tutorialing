import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { IsIn, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { ReviewStatus } from '@prisma/client';
import { CurrentUser, Permissions, Roles, type AuthUser } from '../../common/auth';
import { ReviewsService } from './reviews.service';

class CreateReviewDto {
  @IsString() bookingId!: string;
  @IsInt() @Min(1) @Max(5) rating!: number;
  @IsOptional() @IsString() @Length(2, 3000) comment?: string;
}
class ModerateReviewDto {
  @IsIn(['APPROVED', 'REJECTED', 'NEEDS_REVISION']) status!: 'APPROVED' | 'REJECTED' | 'NEEDS_REVISION';
  @IsOptional() @IsString() note?: string;
}
class ReplyReviewDto { @IsString() @Length(2, 2000) response!: string; }

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly service: ReviewsService) {}
  @Post() create(@CurrentUser() user: AuthUser, @Body() body: CreateReviewDto) { return this.service.create(user.id, body.bookingId, body.rating, body.comment); }
  @Roles('TEACHER') @Post(':id/reply') reply(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: ReplyReviewDto) { return this.service.reply(user.id, id, body.response); }
}

@Roles('ADMIN', 'STAFF')
@Permissions('reviews.manage')
@Controller('admin/reviews')
export class AdminReviewsController {
  constructor(private readonly service: ReviewsService) {}
  @Get() list(@Query('page') page = '1', @Query('limit') limit = '20', @Query('status') status?: ReviewStatus, @Query('search') search = '') {
    return this.service.adminList(Math.max(1, Number(page)), Math.min(100, Math.max(1, Number(limit))), status, search);
  }
  @Post(':id/moderate') moderate(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: ModerateReviewDto) { return this.service.moderate(user.id, id, body.status, body.note); }
}
