import { Controller, Get } from '@nestjs/common';
import { Roles } from '../../common';
import { PermissionKeys, RequirePermissions } from '../auth/authorization';
import { AdminCommerceService } from './admin-commerce.service';
import { ApiTags } from '@nestjs/swagger';

@Roles('ADMIN', 'STAFF')
@ApiTags('admin')
@Controller('admin')
export class AdminCommerceController {
  constructor(private readonly commerce: AdminCommerceService) {}
  @RequirePermissions(PermissionKeys.Reports.Read) @Get('reports') reports() { return this.commerce.reports(); }
  @RequirePermissions(PermissionKeys.Payments.Read) @Get('payments') payments() { return this.commerce.payments(); }
}
