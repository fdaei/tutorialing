import { Controller, Get, Param, Put } from '@nestjs/common';
import { CurrentUser, Roles, type AuthUser } from '../../common';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private s: NotificationsService) {}
  @Get() list(@CurrentUser() u: AuthUser) {
    return this.s.list(u.id);
  }
  @Roles('STUDENT', 'INSTRUCTOR', 'ADMIN', 'SUPPORT')
  @Put('read-all') readAll(@CurrentUser() u: AuthUser) {
    return this.s.readAll(u.id);
  }
  @Put(':id/read') read(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.s.read(u.id, id);
  }
}
