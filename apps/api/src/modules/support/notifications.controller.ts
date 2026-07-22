import { Controller, Get, Param, Put } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../../common/auth';
import { SupportService } from './support.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private s: SupportService) {}
  @Get() list(@CurrentUser() u:AuthUser) { return this.s.notifications(u.id); }
  @Put(':id/read') read(@CurrentUser() u:AuthUser,@Param('id') id:string) { return this.s.read(u.id,id); }
}
