import { Controller, Get } from '@nestjs/common';
import { Roles } from '../../common';
import { PermissionKeys, RequirePermissions } from '../auth/authorization';
import { SupportService } from './support.service';
import { ApiTags } from '@nestjs/swagger';

@Roles('ADMIN', 'STAFF')
@ApiTags('admin')
@RequirePermissions(PermissionKeys.Tickets.Read)
@Controller('admin')
export class AdminSupportController {
  constructor(private readonly support: SupportService) {}
  @Get('tickets') tickets() { return this.support.adminTickets(); }
}
