import { Controller, Get } from '@nestjs/common';
import { Roles } from '../../common';
import { PermissionKeys, RequirePermissions } from '../auth/authorization';
import { BookingsService } from './bookings.service';
import { ApiTags } from '@nestjs/swagger';

@Roles('ADMIN')
@ApiTags('admin')
@RequirePermissions(PermissionKeys.Bookings.Read)
@Controller('admin')
export class AdminBookingsController {
  constructor(private readonly bookings: BookingsService) {}
  @Get('bookings') list() { return this.bookings.adminList(); }
}
