import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, Permissions, Public, Roles, type AuthUser } from '../../common/auth';
import { TestsService } from './tests.service';
import { StartDto } from './dto/request/start.dto';
import { SaveDto } from './dto/request/save.dto';
import { AnswerReviewDto } from './dto/request/answer-review.dto';
import { ReorderDto } from './dto/request/reorder.dto';

@Controller('tests')
export class TestsController {
  constructor(private s: TestsService) {}
  @Public() @Get() list(@Query('languageId') languageId?: string) { return this.s.list(languageId); }
  @Post('attempts') start(@CurrentUser() u: AuthUser, @Body() d: StartDto) { return this.s.start(u.id, d.testId); }
  @Get('attempts/history') history(@CurrentUser() u: AuthUser) { return this.s.history(u.id); }
  @Get('attempts/:id') resume(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.s.resume(u.id, id); }
  @Patch('attempts/:id/answers') save(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: SaveDto) { return this.s.save(u.id, id, d.answers); }
  @Post('attempts/:id/sections/:sectionId/submit') section(@CurrentUser() u: AuthUser, @Param('id') id: string, @Param('sectionId') sectionId: string) { return this.s.submitSection(u.id, id, sectionId); }
  @Post('attempts/:id/submit') submit(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.s.submit(u.id, id); }
}

@Roles('EXAMINER', 'ADMIN')
@Controller('examiner/tests')
export class ExaminerController {
  constructor(private s: TestsService) {}
  @Get('queue') queue(@Query('status') status?: 'pending'|'in_review'|'reviewed'|'needs_revision', @Query('page') page?: string, @Query('pageSize') pageSize?: string) { return this.s.reviewQueue(status, Number(page) || 1, Number(pageSize) || 20); }
  @Post('answers/:id/claim') claim(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.s.claimAnswer(u.id, id); }
  @Post('answers/review') review(@CurrentUser() u: AuthUser, @Body() d: AnswerReviewDto) { return this.s.reviewAnswer(u.id, d); }
}

@Roles('ADMIN', 'STAFF')
@Permissions('tests.manage')
@Controller('admin/tests')
export class TestBuilderController {
  constructor(private s: TestsService) {}
  @Get() list() { return this.s.adminList(); }
  @Post() create(@Body() d: Record<string, unknown>) { return this.s.createDefinition(d); }
  @Post('simple') createSimple(@Body() d: Record<string, unknown>) { return this.s.createSimpleDefinition(d); }
  @Patch(':id') update(@Param('id') id: string, @Body() d: Record<string, unknown>) { return this.s.updateDefinition(id, d); }
  @Delete(':id') remove(@Param('id') id: string) { return this.s.deleteDefinition(id); }
  @Post(':id/sections') section(@Param('id') id: string, @Body() d: Record<string, unknown>) { return this.s.addSection(id, d); }
  @Patch('sections/:id') updateSection(@Param('id') id: string, @Body() d: Record<string, unknown>) { return this.s.updateSection(id, d); }
  @Delete('sections/:id') removeSection(@Param('id') id: string) { return this.s.deleteSection(id); }
  @Post('sections/:id/passages') passage(@Param('id') id: string, @Body() d: Record<string, unknown>) { return this.s.addPassage(id, d); }
  @Patch('passages/:id') updatePassage(@Param('id') id: string, @Body() d: Record<string, unknown>) { return this.s.updatePassage(id, d); }
  @Delete('passages/:id') removePassage(@Param('id') id: string) { return this.s.deletePassage(id); }
  @Post('sections/:id/questions') question(@Param('id') id: string, @Body() d: Record<string, unknown>) { return this.s.addQuestion(id, d); }
  @Patch('questions/:id') updateQuestion(@Param('id') id: string, @Body() d: Record<string, unknown>) { return this.s.updateQuestion(id, d); }
  @Delete('questions/:id') removeQuestion(@Param('id') id: string) { return this.s.deleteQuestion(id); }
  @Patch('sections/:id/questions/reorder') reorder(@Param('id') id: string, @Body() d: ReorderDto) { return this.s.reorderQuestions(id, d.questionIds); }
  @Post('sections/:id/questions/import') importQuestions(@Param('id') id: string, @Body() d: { rows: Record<string, unknown>[] }) { return this.s.importQuestions(id, d.rows); }
}
