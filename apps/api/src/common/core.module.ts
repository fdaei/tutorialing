import{Global,Module}from'@nestjs/common';import{PrismaService}from'../prisma.service';import{AuditService}from'./audit.service';import{RedisService}from'./redis.service';import{SettingsService}from'./settings.service';
@Global()@Module({providers:[PrismaService,AuditService,RedisService,SettingsService],exports:[PrismaService,AuditService,RedisService,SettingsService]})export class CoreModule{}
