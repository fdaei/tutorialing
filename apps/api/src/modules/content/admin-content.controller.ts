import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { RateLimit, RATE_LIMIT_TIERS, Roles } from '../../common';
import { PermissionKeys, RequirePermissions } from '../auth/authorization';
import { ContentService } from './content.service';
import { CmsPageDto } from './dto/cms-page.dto';
import { ApiTags } from '@nestjs/swagger';

@Roles('ADMIN')
@ApiTags('admin')
@RequirePermissions(PermissionKeys.Content.Manage)
@Controller('admin')
export class AdminContentController {
  constructor(private readonly content: ContentService) {}
  @Get('cms') list() { return this.content.list(); }
  @RateLimit(RATE_LIMIT_TIERS.adminWrite)
  @Put('cms/:slug') upsert(@Param('slug') slug: string, @Body() dto: CmsPageDto) { return this.content.upsert(slug, dto); }
}
