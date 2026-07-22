import{Module}from'@nestjs/common';import{LearningController}from'./learning.controller';import{LearningService}from'./learning.service';
import{LearningRepository}from'./learning.repository';@Module({controllers:[LearningController],providers:[LearningService,LearningRepository]})export class LearningModule{}
