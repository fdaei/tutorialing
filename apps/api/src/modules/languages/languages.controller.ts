import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { LanguageDirection, ProficiencySystem } from '@prisma/client';
import { CurrentUser, Permissions, Public, Roles, type AuthUser } from '../../common/auth';
import { LanguagesService } from './languages.service';

class LanguageDto {
  @IsString() @Length(2, 20) code!: string;
  @IsString() @Length(2, 100) nameFa!: string;
  @IsString() @Length(2, 100) nameEn!: string;
  @IsString() @Length(1, 100) nativeName!: string;
  @IsOptional() @IsString() @Length(1, 32) flag?: string;
  @IsEnum(LanguageDirection) direction!: LanguageDirection;
  @IsEnum(ProficiencySystem) proficiencySystem!: ProficiencySystem;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(10000) order?: number;
}

@Controller('languages')
export class LanguagesController {
  constructor(private readonly service: LanguagesService) {}
  @Public() @Get() list() { return this.service.publicList(); }
}

@Roles('ADMIN', 'STAFF')
@Permissions('languages.manage')
@Controller('admin/languages')
export class AdminLanguagesController {
  constructor(private readonly service: LanguagesService) {}

  @Get()
  list(@Query('page') page = '1', @Query('limit') limit = '20', @Query('search') search = '', @Query('active') active?: string) {
    return this.service.adminList(Math.max(1, Number(page)), Math.min(100, Math.max(1, Number(limit))), search, active === undefined ? undefined : active === 'true');
  }
  @Post() create(@CurrentUser() user: AuthUser, @Body() body: LanguageDto) { return this.service.create(user.id, body); }
  @Patch(':id') update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: Partial<LanguageDto>) { return this.service.update(user.id, id, body); }
  @Delete(':id') remove(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.service.remove(user.id, id); }
}
