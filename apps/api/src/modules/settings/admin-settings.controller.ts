import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { RateLimit, RATE_LIMIT_TIERS, Roles } from '../../common';
import { PermissionKeys, RequirePermissions } from '../auth/authorization';
import { SettingDto } from './dto/setting.dto';
import { SettingsService } from './settings.service';
import { ApiTags } from '@nestjs/swagger';

@Roles('ADMIN', 'STAFF')
@ApiTags('admin')
@RequirePermissions(PermissionKeys.Settings.Manage)
@Controller('admin')
export class AdminSettingsController {
  constructor(private readonly settings: SettingsService) {}
  @Get('settings') list() { return this.settings.list(); }
  @RateLimit(RATE_LIMIT_TIERS.adminWrite)
  @Put('settings/:key') set(@Param('key') key: string, @Body() dto: SettingDto) {
    return this.settings.set(key, dto.value, dto.public);
  }
}
