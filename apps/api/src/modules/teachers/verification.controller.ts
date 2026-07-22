import { Body, Controller, Param, Post, Put } from '@nestjs/common';
import { CurrentUser, Permissions, Roles, type AuthUser } from '../../common/auth';
import { VerificationService } from './verification.service';
import { DocumentDto } from './dto/request/document.dto';
import { ResubmitDto } from './dto/request/resubmit.dto';
import { ReviewDto } from './dto/request/review.dto';

@Controller()
export class VerificationController {
  constructor(private readonly service: VerificationService) {}
  @Roles('TEACHER') @Post('teacher/application/documents') attach(@CurrentUser() user: AuthUser, @Body() body: DocumentDto) { return this.service.attach(user.id, body.kind, body.fileId); }
  @Roles('TEACHER') @Post('teacher/application/documents/:id/resubmit') resubmit(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: ResubmitDto) { return this.service.resubmit(user.id, id, body.fileId); }
  @Roles('TEACHER') @Put('teacher/profile/intro-video') video(@CurrentUser() user: AuthUser, @Body() body: { fileId: string }) { return this.service.introVideo(user.id, body.fileId); }
  @Roles('ADMIN', 'STAFF') @Permissions('teachers.verify') @Post('admin/verification-items/:id/review') review(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: ReviewDto) { return this.service.review(user.id, id, body.status, body.note); }
}
