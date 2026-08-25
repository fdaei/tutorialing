import { Global, Module } from '@nestjs/common';
import { RedisService } from './cache/redis.service';
import { PrismaService } from './database/prisma.service';
@Global()
@Module({
  providers: [PrismaService, RedisService],
  exports: [PrismaService, RedisService],
})
export class InfrastructureModule {}
