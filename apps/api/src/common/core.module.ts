import{Global,Module}from'@nestjs/common';import{PrismaService}from'../prisma.service';import{AuditService}from'./audit.service';import{RedisService}from'./redis.service';
@Global()@Module({providers:[PrismaService,AuditService,RedisService],exports:[PrismaService,AuditService,RedisService]})export class CoreModule{}
