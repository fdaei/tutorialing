import { Module } from '@nestjs/common';
import { AdminCourseReviewsController, CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';

@Module({ controllers: [CoursesController, AdminCourseReviewsController], providers: [CoursesService] })
export class CoursesModule {}
