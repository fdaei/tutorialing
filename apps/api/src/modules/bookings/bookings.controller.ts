import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { CurrentUser, RateLimit, RATE_LIMIT_TIERS, Roles, type AuthUser } from '../../common';
import { BookingsService } from './bookings.service';
import { BookingDto } from './dto/request/booking.dto';
import { CancelDto } from './dto/request/cancel.dto';
import { RescheduleDeclineDto, RescheduleDto } from './dto/request/reschedule.dto';
import { AttendanceDto } from './dto/request/attendance.dto';
import { BookingResponseDto } from './dto/response/booking-response.dto';

@Controller('bookings')
export class BookingsController {
  constructor(private s: BookingsService) {}
  // Booking creation takes a Redis slot lock and runs a Serializable
  // transaction, so an unthrottled caller can both squat every slot a teacher
  // has and force repeated serialization conflicts on everyone else's booking.
  @RateLimit(RATE_LIMIT_TIERS.moneyAdjacent)
  @Post() async create(@CurrentUser() u: AuthUser, @Body() d: BookingDto) {
    const b = await this.s.create(u.id, d);
    return plainToInstance(BookingResponseDto, b, { excludeExtraneousValues: true });
  }
  @Get('me') async mine(@CurrentUser() u: AuthUser) {
    const list = await this.s.list(u.id, u.roles.includes('TEACHER') ? 'teacher' : 'student');
    return plainToInstance(BookingResponseDto, list, { excludeExtraneousValues: true });
  }
  @Roles('TEACHER') @Get('students') students(@CurrentUser() u: AuthUser) {
    return this.s.students(u.id);
  }
  @RateLimit(RATE_LIMIT_TIERS.moneyAdjacent)
  @Post(':id/cancel') cancel(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: CancelDto) {
    return this.s.cancel(u.id, id, d.reason);
  }
  // Rescheduling is a two-step agreement: either party proposes, the other
  // responds. No single party can move a confirmed lesson on their own.
  @RateLimit(RATE_LIMIT_TIERS.moneyAdjacent)
  @Post(':id/reschedule') requestReschedule(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() d: RescheduleDto,
  ) {
    return this.s.requestReschedule(u.id, id, d);
  }
  @Post(':id/reschedule/accept') acceptReschedule(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.s.acceptReschedule(u.id, id);
  }
  @Post(':id/reschedule/decline') declineReschedule(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() d: RescheduleDeclineDto,
  ) {
    return this.s.declineReschedule(u.id, id, d.reason);
  }
  @Roles('TEACHER', 'ADMIN', 'STAFF') @Put(':id/attendance') attendance(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() d: AttendanceDto,
  ) {
    return this.s.attendance(u.id, u.roles, id, d);
  }
  @Roles('TEACHER', 'ADMIN', 'STAFF') @Post(':id/complete') complete(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
  ) {
    return this.s.complete(u.id, u.roles, id);
  }
}
