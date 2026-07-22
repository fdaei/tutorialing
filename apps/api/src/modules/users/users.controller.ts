import { Body, Controller, Delete, Get, Param, Put } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../../common/auth';
import { UsersService } from './users.service';
import { ProfileDto } from './dto/request/profile.dto';
import { LocaleDto } from './dto/request/locale.dto';
import { UserProfileMapper } from './mappers/user-profile.mapper';
import { UserProfileResponseDto } from './dto/response/user-profile-response.dto';

@Controller('users/me')
export class UsersController {
  constructor(private s: UsersService) {}

  @Get() async me(@CurrentUser() u: AuthUser): Promise<UserProfileResponseDto> { const user = await this.s.me(u.id); return UserProfileMapper.toResponse(user); }
  @Put() update(@CurrentUser() u: AuthUser, @Body() d: ProfileDto) { return this.s.update(u.id, d); }
  @Put('locale') locale(@CurrentUser() u: AuthUser, @Body() d: LocaleDto) { return this.s.locale(u.id, d.locale); }
  @Get('favorites') favorites(@CurrentUser() u: AuthUser) { return this.s.favorites(u.id); }
  @Put('favorites/:teacherId') fav(@CurrentUser() u: AuthUser, @Param('teacherId') id: string) { return this.s.favorite(u.id, id); }
  @Delete('favorites/:teacherId') unfav(@CurrentUser() u: AuthUser, @Param('teacherId') id: string) { return this.s.unfavorite(u.id, id); }
}
