import { Body, Controller, Get, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, Public, Roles, type AuthUser } from '../../common/auth';
import { TeachersService } from './teachers.service';
import { ApplicationDto } from './dto/request/application.dto';

@Controller('teachers')
export class TeachersController {
  constructor(private readonly service: TeachersService) {}

  @Public() @Get()
  list(
    @Query('page') page = '1',
    @Query('limit') limit = '12',
    @Query('search') search?: string,
    @Query('skill') skill?: string,
    @Query('language') language?: string,
    @Query('minBand') band?: string,
    @Query('maxPrice') price?: string,
    @Query('sort') sort?: string,
  ) {
    return this.service.directory({
      page: Math.max(1, Number(page)),
      limit: Math.min(50, Math.max(1, Number(limit))),
      search,
      skill,
      language,
      minBand: band ? Number(band) : undefined,
      maxPrice: price ? Number(price) : undefined,
      sort,
    });
  }

  @Public() @Get(':slug')
  async profile(@Param('slug') slug: string) {
    const teacher = await this.service.profile(slug);
    if (!teacher) throw new NotFoundException();
    return teacher;
  }
}

@Controller('teacher/application')
@Roles('TEACHER', 'STUDENT')
export class TeacherApplicationController {
  constructor(private readonly service: TeachersService) {}
  @Get() mine(@CurrentUser() user: AuthUser) { return this.service.mine(user.id); }
  @Post() create(@CurrentUser() user: AuthUser, @Body() body: ApplicationDto) { return this.service.application(user.id, body); }
  @Patch() update(@CurrentUser() user: AuthUser, @Body() body: ApplicationDto) { return this.service.application(user.id, body); }
  @Post('submit') submit(@CurrentUser() user: AuthUser) { return this.service.submit(user.id); }
}
