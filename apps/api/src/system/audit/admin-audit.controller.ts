import { Controller, Get } from '@nestjs/common';
import { Roles } from '../../common';
import { PermissionKeys, RequirePermissions } from '../../modules/auth/authorization';
import { AuditService } from './audit.service';
import { ApiTags } from '@nestjs/swagger';

@Roles('ADMIN', 'STAFF')
@ApiTags('admin')
@RequirePermissions(PermissionKeys.Audit.Read)
@Controller('admin')
export class AdminAuditController {
  constructor(private readonly audit: AuditService) {}
  @Get('audit-logs') list() { return this.audit.list(); }
}
