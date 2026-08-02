import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

export type Tx = Prisma.TransactionClient;

@Injectable() export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy { async onModuleInit(){ await this.$connect(); } async onModuleDestroy(){ await this.$disconnect(); } }

/**
 * Anything that can run a query: the root client or an interactive transaction.
 * Use it for helpers that must work both inside and outside `$transaction`.
 */
export type DbClient = PrismaService | Tx;
