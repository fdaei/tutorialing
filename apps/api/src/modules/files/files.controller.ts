import { Body, Controller, Get, Headers, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser, RateLimit, RATE_LIMIT_TIERS, type AuthUser } from '../../common';
import { FilesService } from './files.service';
import { UploadDto } from './dto/request/upload.dto';

@Controller('files')
export class FilesController {
  constructor(private s: FilesService) {}

  @RateLimit(RATE_LIMIT_TIERS.fileUpload)
  @Post('uploads')
  upload(@CurrentUser() u: AuthUser, @Body() d: UploadDto) {
    return this.s.createUpload(u.id, d);
  }

  @RateLimit(RATE_LIMIT_TIERS.fileUpload)
  @Post('uploads/:id/content')
  uploadContent(@CurrentUser() u: AuthUser, @Param('id') id: string, @Headers('x-content-checksum') checksum: string, @Req() request: Request) {
    return this.s.uploadContent(u.id, id, checksum, request);
  }

  @RateLimit(RATE_LIMIT_TIERS.fileUpload)
  @Post(':id/complete')
  complete(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.s.complete(u.id, id);
  }

  @Get(':id/download')
  download(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.s.download(u.id, u.roles, id);
  }
}
