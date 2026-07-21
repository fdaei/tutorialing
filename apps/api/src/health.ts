import { Controller, Get } from '@nestjs/common';import{Public}from'./common/auth';import{PrismaService}from'./prisma.service';
@Controller('health') export class HealthController {constructor(private db:PrismaService){} @Public()@Get()async health(){await this.db.$queryRaw`SELECT 1`;return { status:'ok', service:'lingospeak-api', database:'connected', time:new Date().toISOString() }; } }
