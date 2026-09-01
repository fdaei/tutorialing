import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, Public, RateLimit, RATE_LIMIT_TIERS, Roles, type AuthUser } from '../../common';
import { PermissionKeys, RequirePermissions } from '../auth/authorization';
import { CoursesService } from './courses.service';
import { CourseReviewDto } from './dto/course-review.dto';
import { CourseProgressDto } from './dto/course-progress.dto';
import { CourseChapterDto, CourseLessonDto } from './dto/course-curriculum.dto';
import { AdminCourseDto } from './dto/admin-course.dto';

@Controller('courses')
export class CoursesController {
  constructor(private readonly service: CoursesService) {}
  @Public() @RateLimit(RATE_LIMIT_TIERS.publicRead) @Get() list() {
    return this.service.list();
  }
  @Get('me/learning') learning(@CurrentUser() user: AuthUser) {
    return this.service.learning(user.id);
  }
  @Get(':courseId/player') player(@CurrentUser() user: AuthUser, @Param('courseId') courseId: string) {
    return this.service.player(user.id, courseId);
  }
  @Patch(':courseId/lessons/:lessonId/progress') progress(
    @CurrentUser() user: AuthUser,
    @Param('courseId') courseId: string,
    @Param('lessonId') lessonId: string,
    @Body() body: CourseProgressDto,
  ) {
    return this.service.progress(user.id, courseId, lessonId, body);
  }
  @Get(':courseId/my-review') mine(@CurrentUser() user: AuthUser, @Param('courseId') courseId: string) {
    return this.service.mine(user.id, courseId);
  }
  @Get(':courseId/review-eligibility') eligibility(@CurrentUser() user: AuthUser, @Param('courseId') courseId: string) {
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

@Roles('INSTRUCTOR', 'ADMIN')
@ApiTags('courses')
@Controller('instructor/courses')
export class InstructorCoursesController {
  constructor(private readonly service: CoursesService) {}

  @Get() mine(@CurrentUser() user: AuthUser) {
    return this.service.instructorCourses(user);
  }

  @Get(':courseId/curriculum') curriculum(@CurrentUser() user: AuthUser, @Param('courseId') courseId: string) {
    return this.service.instructorCurriculum(user, courseId);
  }

  @Post(':courseId/chapters') createChapter(
    @CurrentUser() user: AuthUser,
    @Param('courseId') courseId: string,
    @Body() body: CourseChapterDto,
  ) {
    return this.service.createChapter(user, courseId, body);
  }

  @Patch(':courseId/chapters/:chapterId') updateChapter(
    @CurrentUser() user: AuthUser,
    @Param('courseId') courseId: string,
    @Param('chapterId') chapterId: string,
    @Body() body: CourseChapterDto,
  ) {
    return this.service.updateChapter(user, courseId, chapterId, body);
  }

  @Delete(':courseId/chapters/:chapterId') removeChapter(
    @CurrentUser() user: AuthUser,
    @Param('courseId') courseId: string,
    @Param('chapterId') chapterId: string,
  ) {
    return this.service.removeChapter(user, courseId, chapterId);
  }

  @Post(':courseId/chapters/:chapterId/lessons') createLesson(
    @CurrentUser() user: AuthUser,
    @Param('courseId') courseId: string,
    @Param('chapterId') chapterId: string,
    @Body() body: CourseLessonDto,
  ) {
    return this.service.createLesson(user, courseId, chapterId, body);
  }

  @Patch(':courseId/lessons/:lessonId') updateLesson(
    @CurrentUser() user: AuthUser,
    @Param('courseId') courseId: string,
    @Param('lessonId') lessonId: string,
    @Body() body: CourseLessonDto,
  ) {
    return this.service.updateLesson(user, courseId, lessonId, body);
  }

  @Delete(':courseId/lessons/:lessonId') removeLesson(
    @CurrentUser() user: AuthUser,
    @Param('courseId') courseId: string,
    @Param('lessonId') lessonId: string,
  ) {
    return this.service.removeLesson(user, courseId, lessonId);
  }
}

@Roles('ADMIN')
@RequirePermissions(PermissionKeys.Courses.Manage)
@ApiTags('admin')
@Controller('admin/courses')
export class AdminCoursesController {
  constructor(private readonly service: CoursesService) {}

  @Get() list() {
    return this.service.adminCourses();
  }

  @Get('instructors') instructors() {
    return this.service.courseInstructors();
  }

  @Post() create(@Body() body: AdminCourseDto) {
    return this.service.createCourse(body);
  }

  @Patch(':id') update(@Param('id') id: string, @Body() body: AdminCourseDto) {
    return this.service.updateCourse(id, body);
  }
}

@Roles('ADMIN')
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
