import { Injectable } from '@nestjs/common';
import { PrismaService, Tx } from '../../../prisma.service';

/**
 * Reads operational rules the admin panel owns out of the `Setting` table.
 *
 * These are values the business changes without a deploy — commission
 * percentage, escrow hold, booking lead time. `Setting.value` is a Json column,
 * so anything a previous admin write left there has to be tolerated: a bad or
 * missing row falls back to the caller's default rather than taking a request
 * down or, worse, silently applying a nonsensical rule.
 */
@Injectable()
export class SettingsService {
  constructor(private db: PrismaService) {}

  async numeric(key: string, fallback: number, max: number, tx: Tx = this.db) {
    const row = await tx.setting.findUnique({ where: { key } });
    const raw = row?.value;
    const value = typeof raw === 'number'
      ? raw
      : typeof raw === 'object' && raw !== null && !Array.isArray(raw) && typeof (raw as Record<string, unknown>).value === 'number'
        ? (raw as { value: number }).value
        : undefined;
    if (value === undefined || !Number.isFinite(value) || value < 0 || value > max) return fallback;
    return value;
  }
}
