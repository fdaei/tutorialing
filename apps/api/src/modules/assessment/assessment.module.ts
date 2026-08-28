import { Module } from '@nestjs/common';
import { TestsController, ExaminerController, AdminTestBuilderController } from './tests.controller';
import { TestsService } from './tests.service';
import { ScoringService } from './scoring.service';
import { PlacementController } from './placement.controller';
import { PlacementService } from './placement.service';
@Module({
  controllers: [TestsController, ExaminerController, AdminTestBuilderController, PlacementController],
  providers: [TestsService, ScoringService, PlacementService],
})
export class AssessmentModule {}
