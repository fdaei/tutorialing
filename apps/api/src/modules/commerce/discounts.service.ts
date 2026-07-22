import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class DiscountsService {
  constructor(private db: PrismaService) {}

  createDiscount(data: { code: string; type: string; value: number; maxUses?: number; startsAt?: string; endsAt?: string }) {
    return this.db.discount.create({ data: { ...data, startsAt: data.startsAt ? new Date(data.startsAt) : undefined, endsAt: data.endsAt ? new Date(data.endsAt) : undefined } });
  }
}
