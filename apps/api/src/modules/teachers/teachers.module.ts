import { Module } from '@nestjs/common';
import { TeachersController, TeacherApplicationController } from './teachers.controller';
import { VerificationController } from './verification.controller';
import { TeachersService } from './teachers.service';
import { VerificationService } from './verification.service';
import { PricingService } from './pricing.service';
import { AdminPricingController, TeacherPricingController } from './pricing.controller';
import { ReviewsService } from './reviews.service';
import { AdminReviewsController, ReviewsController } from './reviews.controller';

@Module({
  controllers: [TeachersController, TeacherApplicationController, VerificationController, TeacherPricingController, AdminPricingController, ReviewsController, AdminReviewsController],
  providers: [TeachersService, VerificationService, PricingService, ReviewsService],
  exports: [TeachersService, PricingService, ReviewsService],
})
export class TeachersModule {}
