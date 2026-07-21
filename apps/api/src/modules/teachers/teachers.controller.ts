import { Body, Controller, Get, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common';
import { ArrayNotEmpty, IsArray, IsIn, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { CurrentUser, Public, Roles, type AuthUser } from '../../common/auth';
import { TeachersService } from './teachers.service';

class ApplicationDto {
  @IsString() @Length(2, 80) nameFa!: string;
  @IsString() @Length(2, 80) nameEn!: string;
  @IsString() @Length(40, 3000) bioFa!: string;
  @IsString() @Length(40, 3000) bioEn!: string;
  @IsArray() specialties!: string[];
  @IsArray() @ArrayNotEmpty() languageIds!: string[];
  @IsOptional() @IsArray() levels?: string[];
  @IsInt() @Min(0) @Max(60) experienceYears!: number;
  @IsOptional() @IsIn(['female', 'male', 'other', 'prefer_not_to_say']) gender?: string;
  @IsOptional() @IsInt() @Min(20) @Max(180) lessonDuration?: number;
  @IsOptional() @IsInt() @Min(15) @Max(90) trialDuration?: number;
  @IsOptional() @IsInt() @Min(0) @Max(120) breakMinutes?: number;
}

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
