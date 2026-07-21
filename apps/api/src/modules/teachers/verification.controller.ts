import { Body, Controller, Param, Post, Put } from '@nestjs/common';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { DocumentStatus } from '@prisma/client';
import { CurrentUser, Permissions, Roles, type AuthUser } from '../../common/auth';
import { VerificationService } from './verification.service';

class DocumentDto { @IsIn(['identity', 'certificate', 'experience', 'demo-lesson']) kind!: string; @IsString() fileId!: string; }
class ReviewDto { @IsIn(['UNDER_REVIEW', 'APPROVED', 'REJECTED', 'NEEDS_REVISION']) status!: DocumentStatus; @IsOptional() @IsString() note?: string; }
class ResubmitDto { @IsString() fileId!: string; }

@Controller()
export class VerificationController {
  constructor(private readonly service: VerificationService) {}
  @Roles('TEACHER') @Post('teacher/application/documents') attach(@CurrentUser() user: AuthUser, @Body() body: DocumentDto) { return this.service.attach(user.id, body.kind, body.fileId); }
  @Roles('TEACHER') @Post('teacher/application/documents/:id/resubmit') resubmit(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: ResubmitDto) { return this.service.resubmit(user.id, id, body.fileId); }
  @Roles('TEACHER') @Put('teacher/profile/intro-video') video(@CurrentUser() user: AuthUser, @Body() body: { fileId: string }) { return this.service.introVideo(user.id, body.fileId); }
  @Roles('ADMIN', 'STAFF') @Permissions('teachers.verify') @Post('admin/verification-items/:id/review') review(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: ReviewDto) { return this.service.review(user.id, id, body.status, body.note); }
}
