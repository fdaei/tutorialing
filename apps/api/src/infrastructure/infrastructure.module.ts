import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis/redis.service';
import { PrismaService } from './database/prisma.service';
import { MessagingModule } from './messaging/messaging.module';
import { REVOCATION_STORE } from '../modules/auth/revocation-store.port';
import { RedisRevocationStoreAdapter } from './redis/redis-revocation-store.adapter';
import { StorageModule } from './storage/storage.module';
import { BullmqModule } from './jobs/bullmq/bullmq.module';
import { LoggingModule } from './logging/logging.module';
@Global()
@Module({
  imports: [LoggingModule, MessagingModule, StorageModule, BullmqModule],
  providers: [
    PrismaService,
    RedisService,
    RedisRevocationStoreAdapter,
    { provide: REVOCATION_STORE, useExisting: RedisRevocationStoreAdapter },
  ],
  exports: [PrismaService, RedisService, LoggingModule, MessagingModule, StorageModule, BullmqModule, REVOCATION_STORE],
})
export class InfrastructureModule {}
