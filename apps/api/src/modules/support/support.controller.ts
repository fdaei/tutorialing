import { Body, Controller, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { CurrentUser, Permissions, Public, Roles, type AuthUser } from '../../common/auth';
import { SupportService } from './support.service';
import { TicketDto } from './dto/request/ticket.dto';
import { ReplyDto } from './dto/request/reply.dto';
import { StatusDto } from './dto/request/status.dto';
import { AssignmentDto } from './dto/request/assignment.dto';

@Controller('support')
export class SupportController {
  constructor(private s: SupportService) {}
  @Public() @Get('public-settings') settings() { return this.s.settings(); }
  @Public() @Get('pages/:slug') page(@Param('slug') slug:string) { return this.s.page(slug); }
  @Post('tickets') create(@CurrentUser() u:AuthUser,@Body() d:TicketDto) { return this.s.create(u.id,u.roles,d); }
  @Get('tickets') list(@CurrentUser() u:AuthUser,@Query() q:Record<string,string>) { return this.s.list(u.id,u.roles,{...q,page:Number(q.page)||1,pageSize:Number(q.pageSize)||20}); }
  @Get('tickets/:id') detail(@CurrentUser() u:AuthUser,@Param('id') id:string) { return this.s.detail(u.id,u.roles,id); }
  @Post('tickets/:id/replies') reply(@CurrentUser() u:AuthUser,@Param('id') id:string,@Body() d:ReplyDto) { return this.s.reply(u.id,u.roles,id,d); }
  @Roles('ADMIN','STAFF','SUPPORT') @Permissions('tickets.manage') @Patch('tickets/:id/status') status(@CurrentUser() u:AuthUser,@Param('id') id:string,@Body() d:StatusDto) { return this.s.changeStatus(u.id,u.roles,id,d.status,d.note); }
  @Roles('ADMIN','STAFF','SUPPORT') @Permissions('tickets.manage') @Patch('tickets/:id/assignment') assign(@CurrentUser() u:AuthUser,@Param('id') id:string,@Body() d:AssignmentDto) { return this.s.assign(u.id,u.roles,id,d.assignedToId ?? null,d.note); }
}
