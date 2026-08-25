import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
<<<<<<< Updated upstream
import { CurrentUser, Permissions, Public, Roles, type AuthUser } from '../../common';
||||||| Stash base
import { CurrentUser, Permissions, Public, Roles, type AuthUser } from '../../common/auth';
=======
import { Authorize, CurrentUser, Public, type AuthUser } from '../../common/auth';
>>>>>>> Stashed changes
import { LanguagesService } from './languages.service';
import { LanguageDto } from './dto/request/language.dto';
import { UpdateLanguageDto } from './dto/request/update-language.dto';

@Controller('languages')
export class LanguagesController {
  constructor(private readonly service: LanguagesService) {}
  @Public() @Get() list() {
    return this.service.publicList();
  }
}

@Authorize(['ADMIN', 'STAFF'], ['languages.manage'])
@Controller('admin/languages')
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
