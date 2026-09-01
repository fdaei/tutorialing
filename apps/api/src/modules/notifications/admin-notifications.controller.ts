import { Controller, Get } from '@nestjs/common';
import { Roles } from '../../common';
import { PermissionKeys, RequirePermissions } from '../auth/authorization';
import { NotificationsService } from './notifications.service';
import { ApiTags } from '@nestjs/swagger';

@Roles('ADMIN')
@ApiTags('admin')
@RequirePermissions(PermissionKeys.Notifications.Read)
@Controller('admin')
export class AdminNotificationsController {
  constructor(private readonly notifications: NotificationsService) {}
  @Get('notification-deliveries') deliveries() { return this.notifications.deliveries(); }
}
