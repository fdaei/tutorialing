import { Module } from '@nestjs/common';
import { TestsController, ExaminerController, AdminTestBuilderController } from './tests.controller';
import { TestsService } from './tests.service';
import { ScoringService } from './scoring.service';
@Module({
  controllers: [TestsController, ExaminerController, AdminTestBuilderController],
  providers: [TestsService, ScoringService],
})
export class AssessmentModule {}
