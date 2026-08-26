import { Module } from '@nestjs/common';
import { TeachersController, TeacherApplicationController } from './teachers.controller';
import { VerificationController } from './verification.controller';
import { TeachersService } from './teachers.service';
import { VerificationService } from './verification.service';
import { PricingService } from './pricing.service';
import { AdminPricingController, TeacherPricingController } from './pricing.controller';
import { ReviewsService } from './reviews.service';
import { AdminReviewsController, ReviewsController } from './reviews.controller';
import { AdminTeachersController } from './admin-teachers.controller';

@Module({
  controllers: [
    TeachersController,
    TeacherApplicationController,
    VerificationController,
    TeacherPricingController,
    AdminPricingController,
    ReviewsController,
    AdminReviewsController,
    AdminTeachersController,
  ],
  providers: [TeachersService, VerificationService, PricingService, ReviewsService],
  exports: [TeachersService, PricingService, ReviewsService],
})
export class TeachersModule {}
