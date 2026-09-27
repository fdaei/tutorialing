import { Module } from '@nestjs/common';
import { CommerceModule } from '../commerce/commerce.module';
import { AdminCourseReviewsController, AdminCoursesController, CoursesController, InstructorCoursesController } from './courses.controller';
import { CoursesService } from './courses.service';

@Module({
  imports: [CommerceModule],
  controllers: [CoursesController, InstructorCoursesController, AdminCoursesController, AdminCourseReviewsController],
  providers: [CoursesService],
})
export class CoursesModule {}
