import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, IsUrl, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CurrentUser, Public, Roles, type AuthUser } from '../../common/auth';
import { AvailabilityService } from './availability.service';
import { BookingsService } from './bookings.service';

class RuleItemDto {
  @IsInt() @Min(0) @Max(6) weekday!: number;
  @IsInt() @Min(0) @Max(1439) startMinute!: number;
  @IsInt() @Min(1) @Max(1440) endMinute!: number;
  @IsString() timezone!: string;
  @IsOptional() @IsInt() @Min(15) @Max(240) lessonDuration?: number;
  @IsOptional() @IsInt() @Min(0) @Max(120) breakMinutes?: number;
}
class RulesDto { @IsArray() @ValidateNested({ each: true }) @Type(() => RuleItemDto) rules!: RuleItemDto[]; }
class BookingDto { @IsString() teacherId!: string; @IsDateString() startsAt!: string; @IsIn(['trial', 'regular']) type!: 'trial'|'regular'; @IsOptional() @IsString() enrollmentId?: string; @IsBoolean() policyAccepted!: boolean; @IsString() timezone!: string; }
class CancelDto { @IsString() reason!: string; }
class RescheduleDto { @IsDateString() startsAt!: string; @IsString() timezone!: string; }
class AttendanceDto { @IsOptional() @IsBoolean() student?: boolean; @IsOptional() @IsBoolean() teacher?: boolean; @IsOptional() @IsUrl({ require_tld: false }) meetingUrl?: string; }
class OverrideDto { @IsDateString() date!:string; @IsBoolean() available!:boolean; @IsOptional() @IsInt() @Min(0) @Max(1439) startMinute?:number; @IsOptional() @IsInt() @Min(1) @Max(1440) endMinute?:number; @IsOptional() @IsString() reason?:string; }
class BlockDto { @IsDateString() startsAt!:string; @IsDateString() endsAt!:string; @IsOptional() @IsString() reason?:string; @IsOptional() @IsString() teacherId?:string; }

@Controller('availability')
export class AvailabilityController {
  constructor(private s: AvailabilityService) {}
  @Roles('TEACHER') @Get('me') mine(@CurrentUser() u:AuthUser){return this.s.mine(u.id);}
  @Public() @Get(':teacherId/slots') slots(@Param('teacherId') id:string,@Query('from') from:string,@Query('to') to:string,@Query('type') type?:'trial'|'regular'){return this.s.slots(id,new Date(from),new Date(to),type==='trial'?'trial':'regular');}
  @Roles('TEACHER') @Put('me/rules') rules(@CurrentUser() u:AuthUser,@Body() d:RulesDto){return this.s.setRules(u.id,d.rules);}
  @Roles('TEACHER') @Post('me/overrides') override(@CurrentUser() u:AuthUser,@Body() d:OverrideDto){return this.s.addOverride(u.id,d);}
  @Roles('TEACHER') @Delete('me/overrides/:id') deleteOverride(@CurrentUser() u:AuthUser,@Param('id') id:string){return this.s.deleteOverride(u.id,id);}
  @Roles('TEACHER') @Post('me/blocks') block(@CurrentUser() u:AuthUser,@Body() d:BlockDto){return this.s.addBlock(u.id,d);}
  @Roles('TEACHER') @Delete('me/blocks/:id') deleteBlock(@CurrentUser() u:AuthUser,@Param('id') id:string){return this.s.deleteBlock(u.id,id);}
  @Roles('ADMIN','STAFF') @Post('admin/blocks') adminBlock(@Body() d:BlockDto){return this.s.addAdminBlock(d);}
  @Roles('ADMIN','STAFF') @Delete('admin/blocks/:id') adminDeleteBlock(@Param('id') id:string){return this.s.deleteBlock('',id,true);}
}

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
