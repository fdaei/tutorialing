import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, Public, Roles, type AuthUser } from '../../common';
import { PermissionKeys, RequirePermissions } from '../auth/authorization';
import { LanguagesService } from './languages.service';
import { LanguageDto } from './dto/request/language.dto';
import { UpdateLanguageDto } from './dto/request/update-language.dto';
import { ApiTags } from '@nestjs/swagger';
import { CountryDto, UpdateCountryDto } from './dto/request/country.dto';

@Controller('languages')
export class LanguagesController {
  constructor(private readonly service: LanguagesService) {}
  @Public() @Get() list() {
    return this.service.publicList();
  }
}

@Controller('countries')
export class CountriesController {
  constructor(private readonly service: LanguagesService) {}
  @Public() @Get() list() {
    return this.service.publicCountries();
  }
}

@Roles('ADMIN', 'STAFF')
@RequirePermissions(PermissionKeys.Languages.Manage)
@Controller('admin/languages')
@ApiTags('admin')
export class AdminLanguagesController {
  constructor(private readonly service: LanguagesService) {}

  @Get()
  list(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('search') search = '',
    @Query('active') active?: string,
  ) {
    return this.service.adminList(
      Math.max(1, Number(page)),
      Math.min(100, Math.max(1, Number(limit))),
      search,
      active === undefined ? undefined : active === 'true',
    );
  }
  @Post() create(@CurrentUser() user: AuthUser, @Body() body: LanguageDto) {
    return this.service.create(user.id, body);
  }
  @Patch(':id') update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: UpdateLanguageDto) {
    return this.service.update(user.id, id, body);
  }
  @Delete(':id') remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(user.id, id);
  }
}

@Roles('ADMIN', 'STAFF')
@RequirePermissions(PermissionKeys.Languages.Manage)
@Controller('admin/countries')
@ApiTags('admin')
export class AdminCountriesController {
  constructor(private readonly service: LanguagesService) {}

  @Get()
  list(@Query('page') page = '1', @Query('limit') limit = '30', @Query('search') search = '') {
    return this.service.adminCountries(Math.max(1, Number(page)), Math.min(100, Math.max(1, Number(limit))), search);
  }
  @Post() create(@CurrentUser() user: AuthUser, @Body() body: CountryDto) {
    return this.service.createCountry(user.id, body);
  }
  @Patch(':id') update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: UpdateCountryDto) {
    return this.service.updateCountry(user.id, id, body);
  }
  @Delete(':id') remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.removeCountry(user.id, id);
  }
}
