import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

@Injectable()
export class DashboardReadRepository {
  constructor(private readonly db: PrismaService) {}

  load() {
    return this.db.$transaction([
      this.db.dashboardStat.findUniqueOrThrow({ where: { id: 'platform' } }),
      this.db.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 8 }),
    ]);
  }
}
