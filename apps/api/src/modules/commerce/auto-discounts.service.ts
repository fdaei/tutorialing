import { Injectable } from '@nestjs/common';
import type { DiscountRule } from '@prisma/client';
import { PrismaService, Tx } from '../../prisma.service';

const DAY_MS = 86_400_000;

export type AutoDiscount = { ruleId: string; amount: number; trigger: string };

/**
 * Evaluates automatic discounts — the ones a student gets without entering a
 * code, currently the birthday discount.
 *
 * Driven by `DiscountRule` rows rather than a hardcoded birthday branch, so the
 * value, cap and window are configurable and a second trigger can be added
 * without touching checkout. Every rule for the trigger is evaluated and the
 * most valuable one wins.
 */
@Injectable()
export class AutoDiscountsService {
  constructor(private db: PrismaService) {}

  /**
   * Days between a birth date's month/day and today, ignoring the year and
   * handling the wrap around the end of the year, so a birthday on 1 January
   * still matches a window that opens in late December.
   *
   * Compared in the user's own timezone: "is it my birthday" is a question about
   * the student's local date, not UTC, and near midnight the two disagree.
   */
  private daysFromBirthday(birthDate: Date, timezone: string, now = new Date()) {
    const localParts = (zone: string) => {
      const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
      const value = (kind: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === kind)?.value ?? '0');
      return { year: value('year'), month: value('month'), day: value('day') };
    };
    // A stored timezone can be stale or malformed; a bad one must not cost the
    // student their discount, so it degrades to the platform default.
    let today;
    try { today = localParts(timezone); }
    catch { today = localParts('Asia/Tehran'); }
    // The birth date is a date-only value stored at UTC midnight, so its
    // month/day must be read in UTC — reading it in a negative-offset zone would
    // shift it to the previous day.
    const birthMonth = birthDate.getUTCMonth() + 1;
    const birthDay = birthDate.getUTCDate();
    const asUtc = (year: number, month: number, day: number) => Date.UTC(year, month - 1, day);
    const todayUtc = asUtc(today.year, today.month, today.day);
    const candidates = [today.year - 1, today.year, today.year + 1].map((year) => asUtc(year, birthMonth, birthDay));
    return Math.min(...candidates.map((candidate) => Math.abs(candidate - todayUtc) / DAY_MS));
  }

  private amountFor(rule: DiscountRule, subtotal: number) {
    const raw = rule.type === 'percent' ? Math.round(subtotal * rule.value / 100) : rule.value;
    const capped = rule.maxAmount != null ? Math.min(raw, rule.maxAmount) : raw;
    return Math.max(0, Math.min(subtotal, capped));
  }

  /**
   * Returns the best automatic discount for this user and subtotal, or null when
   * none applies.
   */
  async evaluate(tx: Tx, userId: string, subtotal: number): Promise<AutoDiscount | null> {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { birthDate: true, timezone: true } });
    if (!user?.birthDate) return null;
    const rules = await tx.discountRule.findMany({ where: { trigger: 'BIRTHDAY', active: true } });
    if (!rules.length) return null;
    const distance = this.daysFromBirthday(user.birthDate, user.timezone || 'Asia/Tehran');
    const applicable = rules
      .filter((rule) => distance <= rule.windowDays)
      .map((rule) => ({ ruleId: rule.id, amount: this.amountFor(rule, subtotal), trigger: 'BIRTHDAY' }))
      .filter((candidate) => candidate.amount > 0)
      .sort((a, b) => b.amount - a.amount);
    return applicable[0] ?? null;
  }
}
