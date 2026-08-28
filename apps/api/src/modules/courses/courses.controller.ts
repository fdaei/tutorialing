import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, Public, RateLimit, RATE_LIMIT_TIERS, Roles, type AuthUser } from '../../common';
import { PermissionKeys, RequirePermissions } from '../auth/authorization';
import { CoursesService } from './courses.service';
import { CourseReviewDto } from './dto/course-review.dto';

@Controller('courses')
export class CoursesController {
  constructor(private readonly service: CoursesService) {}
  @Public() @RateLimit(RATE_LIMIT_TIERS.publicRead) @Get() list() {
    return this.service.list();
  }
  @Get(':courseId/my-review') mine(@CurrentUser() user: AuthUser, @Param('courseId') courseId: string) {
    return this.service.mine(user.id, courseId);
  }
  @Get(':courseId/review-eligibility') eligibility(
    @CurrentUser() user: AuthUser,
    @Param('courseId') courseId: string,
  ) {
    return this.service.eligibility(user.id, courseId);
  }
  @Post(':courseId/reviews') create(
    @CurrentUser() user: AuthUser,
    @Param('courseId') courseId: string,
    @Body() body: CourseReviewDto,
  ) {
    return this.service.create(user.id, courseId, body.rating, body.comment);
  }
  @Patch('reviews/:id') update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: CourseReviewDto) {
    return this.service.update(user.id, id, body.rating, body.comment);
  }
  @Delete('reviews/:id') remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(user.id, id);
  }
  @Public() @RateLimit(RATE_LIMIT_TIERS.publicRead) @Get(':slug') detail(@Param('slug') slug: string) {
    return this.service.detail(slug);
  }
}

@Roles('ADMIN', 'STAFF')
@RequirePermissions(PermissionKeys.Reviews.Manage)
@ApiTags('admin')
@Controller('admin/course-reviews')
export class AdminCourseReviewsController {
  constructor(private readonly service: CoursesService) {}
  @Get() list() {
    return this.service.adminList();
  }
  @Patch(':id/visibility') visibility(@Param('id') id: string, @Body() body: { published: boolean }) {
    return this.service.setPublished(id, body.published === true);
  }
}
