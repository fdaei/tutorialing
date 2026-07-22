import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { CurrentUser, Roles, type AuthUser } from '../../common/auth';
import { BookingsService } from './bookings.service';
import { BookingDto } from './dto/request/booking.dto';
import { CancelDto } from './dto/request/cancel.dto';
import { RescheduleDto } from './dto/request/reschedule.dto';
import { AttendanceDto } from './dto/request/attendance.dto';

@Controller('bookings')
export class BookingsController {
  constructor(private s: BookingsService) {}
  @Post() create(@CurrentUser() u:AuthUser,@Body() d:BookingDto){return this.s.create(u.id,d);}
  @Get('me') mine(@CurrentUser() u:AuthUser){return this.s.list(u.id,u.roles.includes('TEACHER')?'teacher':'student');}
  @Roles('TEACHER') @Get('students') students(@CurrentUser() u:AuthUser){return this.s.students(u.id);}
  @Post(':id/cancel') cancel(@CurrentUser() u:AuthUser,@Param('id') id:string,@Body() d:CancelDto){return this.s.cancel(u.id,id,d.reason);}
  @Post(':id/reschedule') reschedule(@CurrentUser() u:AuthUser,@Param('id') id:string,@Body() d:RescheduleDto){return this.s.reschedule(u.id,id,d);}
  @Roles('TEACHER','ADMIN','STAFF') @Put(':id/attendance') attendance(@CurrentUser() u:AuthUser,@Param('id') id:string,@Body() d:AttendanceDto){return this.s.attendance(u.id,u.roles,id,d);}
  @Roles('TEACHER','ADMIN','STAFF') @Post(':id/complete') complete(@CurrentUser() u:AuthUser,@Param('id') id:string){return this.s.complete(u.id,u.roles,id);}
}
