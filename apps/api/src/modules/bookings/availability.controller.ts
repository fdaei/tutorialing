import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { CurrentUser, Public, Roles, type AuthUser } from '../../common/auth';
import { AvailabilityService } from './availability.service';
import { RulesDto } from './dto/request/rules.dto';
import { OverrideDto } from './dto/request/override.dto';
import { BlockDto } from './dto/request/block.dto';

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
