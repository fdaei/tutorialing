import { Module } from '@nestjs/common';
import { AuditModule } from './audit/audit.module';
import { HealthModule } from './health/health.module';
import { WorkersModule } from './workers/workers.module';

@Module({ imports: [AuditModule, HealthModule, WorkersModule], exports: [AuditModule, HealthModule] })
export class SystemModule {}
