import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly database: PrismaService) {}

  write(
    actorId: string | undefined,
    action: string,
    entity: string,
    entityId?: string,
    before?: object,
    after?: object,
  ) {
    return this.database.auditLog.create({
      data: { actorId, action, entity, entityId, before, after },
    });
  }
}
