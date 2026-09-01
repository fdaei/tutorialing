import { Module } from '@nestjs/common';
import { AdminCourseReviewsController, AdminCoursesController, CoursesController, InstructorCoursesController } from './courses.controller';
import { CoursesService } from './courses.service';

@Module({
  controllers: [CoursesController, InstructorCoursesController, AdminCoursesController, AdminCourseReviewsController],
  providers: [CoursesService],
})
export class CoursesModule {}
