import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { BlogService } from './blog.service'; import { CurrentUser, Public, Roles, type AuthUser } from '../../common';
@Controller('blog') export class BlogController { constructor(private s:BlogService){}
 @Public() @Get('posts') list(@Query() q:any){return this.s.list(q)}
 @Public() @Get('posts/:slug') detail(@Param('slug') slug:string){return this.s.detail(slug)}
 @Roles('ADMIN','STAFF') @Post('posts') create(@CurrentUser() u:AuthUser,@Body() d:any){return this.s.create(u.id,d)}
 @Roles('ADMIN','STAFF') @Patch('posts/:id') update(@Param('id') id:string,@Body() d:any){return this.s.update(id,d)}
 @Roles('ADMIN','STAFF') @Delete('posts/:id') remove(@Param('id') id:string){return this.s.update(id,{status:'ARCHIVED'})}
 @Roles('ADMIN','STAFF') @Post('posts/:id/publish') publish(@Param('id') id:string){return this.s.publish(id)}
 @Public() @Get('posts/:id/comments') comments(@Param('id') id:string){return this.s.comments(id)}
 @Post('posts/:id/reaction') react(@CurrentUser() u:AuthUser,@Param('id') id:string,@Body('type') type:string){return this.s.react(id,u.id,type)}
 @Post('posts/:id/rating') rate(@CurrentUser() u:AuthUser,@Param('id') id:string,@Body('value') value:number){return this.s.rate(id,u.id,value)}
 @Public() @Post('posts/:id/view') view(@Param('id') id:string,@Body('visitorKey') key:string){return this.s.view(id,key)}
}
