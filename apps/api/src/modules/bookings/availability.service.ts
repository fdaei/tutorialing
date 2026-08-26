import { Injectable } from '@nestjs/common';
import { type AvailabilityOverride, type AvailabilityRule, type BlockedPeriod, type Booking } from '@prisma/client';
import { fromZonedTime } from 'date-fns-tz';
import { PrismaService, type DbClient } from '../../infrastructure/database/prisma.service';
import { badRequest, conflict, notFound } from '../../common';
import { SettingsService } from '../settings/settings.service';
import type {
  AdminBlockedPeriodInput,
  AvailabilityOverrideInput,
  AvailabilityRuleInput,
  AvailabilitySlot,
  BlockedPeriodInput,
  NormalizedAvailabilityRule,
  SlotType,
} from './availability.types';

const DAY_MS = 86_400_000;
const dateKey = (date: Date) => date.toISOString().slice(0, 10);
const zonedDateKey = (date: Date, timezone: string) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = (kind: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === kind)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
};
const utcDate = (value: string | Date) => {
  const key = typeof value === 'string' ? value.slice(0, 10) : dateKey(value);
  return new Date(`${key}T00:00:00.000Z`);
};
const localInstant = (day: string, minute: number, timezone: string) => {
  const hours = String(Math.floor(minute / 60)).padStart(2, '0');
  const minutes = String(minute % 60).padStart(2, '0');
  return fromZonedTime(`${day}T${hours}:${minutes}:00`, timezone);
};
const groupByTeacherId = <T extends { teacherId: string }>(rows: T[]): Map<string, T[]> => {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const bucket = grouped.get(row.teacherId);
    if (bucket) bucket.push(row);
    else grouped.set(row.teacherId, [row]);
  }
  return grouped;
};

type AvailabilityRuleRow = Pick<AvailabilityRule, 'weekday' | 'startMinute' | 'endMinute' | 'timezone' | 'breakMinutes'>;

/** What {@link AvailabilityService.slotsForCandidates} needs per teacher — the
 * scalar fields and active availability rules a caller (the matching
 * questionnaire) has typically already fetched in its own candidate query. */
export type AvailabilityCandidate = {
  id: string;
  trialDuration: number;
  lessonDuration: number;
  breakMinutes: number;
  availabilityRules: AvailabilityRuleRow[];
};

@Injectable()
export class AvailabilityService {
  constructor(
    private db: PrismaService,
    private settings: SettingsService,
  ) {}

  async mine(userId: string) {
    const teacher = await this.db.teacher.findUnique({ where: { userId } });
    if (!teacher) throw notFound('TEACHER_PROFILE_NOT_FOUND');
    const now = new Date();
    const [rules, overrides, blocks] = await this.db.$transaction([
      this.db.availabilityRule.findMany({
        where: { teacherId: teacher.id },
        orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }],
      }),
      this.db.availabilityOverride.findMany({
        where: { teacherId: teacher.id, date: { gte: utcDate(new Date(now.getTime() - 7 * DAY_MS)) } },
        orderBy: { date: 'asc' },
        take: 180,
      }),
      this.db.blockedPeriod.findMany({
        where: { teacherId: teacher.id, endsAt: { gte: new Date(now.getTime() - 7 * DAY_MS) } },
        orderBy: { startsAt: 'asc' },
        take: 250,
      }),
    ]);
    return { teacherId: teacher.id, timezone: rules[0]?.timezone ?? 'Asia/Tehran', rules, overrides, blocks };
  }

  async setRules(userId: string, rules: AvailabilityRuleInput[]) {
    const teacher = await this.db.teacher.findUnique({ where: { userId } });
    if (!teacher) throw notFound('TEACHER_PROFILE_NOT_FOUND');
    const normalized = rules.map((rule, index) => this.validateRule(rule, index));
    for (const weekday of new Set(normalized.map((rule) => rule.weekday))) {
      const rows = normalized.filter((rule) => rule.weekday === weekday).sort((a, b) => a.startMinute - b.startMinute);
      for (let i = 1; i < rows.length; i += 1) {
        if (rows[i]!.startMinute < rows[i - 1]!.endMinute) {
          throw conflict('AVAILABILITY_RULE_OVERLAP');
        }
      }
    }
    return this.db.$transaction(async (tx) => {
      await tx.availabilityRule.deleteMany({ where: { teacherId: teacher.id } });
      if (normalized.length)
        await tx.availabilityRule.createMany({ data: normalized.map((rule) => ({ ...rule, teacherId: teacher.id })) });
      return tx.availabilityRule.findMany({
        where: { teacherId: teacher.id },
        orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }],
      });
    });
  }

  private validateRule(rule: AvailabilityRuleInput, index: number): NormalizedAvailabilityRule {
    const field = `rules.${index}`;
    if (!Number.isInteger(rule.weekday) || rule.weekday < 0 || rule.weekday > 6) {
      throw badRequest('AVAILABILITY_WEEKDAY_INVALID');
    }
    if (
      !Number.isInteger(rule.startMinute) ||
      !Number.isInteger(rule.endMinute) ||
      rule.startMinute < 0 ||
      rule.endMinute > 1440
    ) {
      throw badRequest('AVAILABILITY_TIME_INVALID');
    }
    if (rule.startMinute >= rule.endMinute) {
      throw badRequest('AVAILABILITY_END_BEFORE_START');
    }
    const lessonDuration = rule.lessonDuration ?? 60;
    // No gap between back-to-back lessons is required — the earlier 10-minute
    // buffer requirement was reversed. A teacher may still opt into one.
    const breakMinutes = rule.breakMinutes ?? 0;
    if (!Number.isInteger(lessonDuration) || lessonDuration < 15 || lessonDuration > 240) {
      throw badRequest('LESSON_DURATION_INVALID');
    }
    if (!Number.isInteger(breakMinutes) || breakMinutes < 0 || breakMinutes > 120) {
      throw badRequest('BREAK_DURATION_INVALID');
    }
    if (rule.endMinute - rule.startMinute < lessonDuration) {
      throw badRequest('AVAILABILITY_RANGE_TOO_SHORT');
    }
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: rule.timezone }).format(new Date());
    } catch {
      throw badRequest('TIMEZONE_INVALID');
    }
    return { ...rule, lessonDuration, breakMinutes };
  }

  async addOverride(userId: string, data: AvailabilityOverrideInput) {
    const teacher = await this.db.teacher.findUnique({ where: { userId } });
    if (!teacher) throw notFound('TEACHER_PROFILE_NOT_FOUND');
    const date = utcDate(data.date);
    if (!Number.isFinite(date.getTime()) || date < utcDate(new Date())) {
      throw badRequest('AVAILABILITY_DATE_PAST');
    }
    if (data.available && (data.startMinute == null || data.endMinute == null || data.startMinute >= data.endMinute)) {
      throw badRequest('OVERRIDE_TIME_INVALID');
    }
    return this.db.availabilityOverride.upsert({
      where: { teacherId_date: { teacherId: teacher.id, date } },
      create: {
        teacherId: teacher.id,
        date,
        available: data.available,
        startMinute: data.available ? data.startMinute : null,
        endMinute: data.available ? data.endMinute : null,
        reason: data.reason,
      },
      update: {
        available: data.available,
        startMinute: data.available ? data.startMinute : null,
        endMinute: data.available ? data.endMinute : null,
        reason: data.reason,
      },
    });
  }

  async deleteOverride(userId: string, id: string) {
    const result = await this.db.availabilityOverride.deleteMany({ where: { id, teacher: { userId } } });
    if (!result.count) throw notFound('AVAILABILITY_OVERRIDE_NOT_FOUND');
    return { ok: true };
  }

  async addBlock(userId: string, data: BlockedPeriodInput) {
    const teacher = await this.db.teacher.findUnique({ where: { userId } });
    if (!teacher) throw notFound('TEACHER_PROFILE_NOT_FOUND');
    return this.createBlock(teacher.id, data, false);
  }

  async addAdminBlock(data: AdminBlockedPeriodInput) {
    if (!data.teacherId) throw badRequest('TEACHER_REQUIRED');
    const exists = await this.db.teacher.count({ where: { id: data.teacherId } });
    if (!exists) throw notFound('TEACHER_NOT_FOUND');
    return this.createBlock(data.teacherId, data, true);
  }

  private async createBlock(teacherId: string, data: BlockedPeriodInput, adminCreated: boolean) {
    const startsAt = new Date(data.startsAt);
    const endsAt = new Date(data.endsAt);
    if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime())) {
      throw badRequest('BLOCKED_PERIOD_DATE_INVALID');
    }
    if (startsAt >= endsAt) {
      throw badRequest('AVAILABILITY_END_BEFORE_START');
    }
    if (endsAt <= new Date()) throw badRequest('BLOCKED_PERIOD_PAST');
    const overlapping = await this.db.blockedPeriod.findFirst({
      where: { teacherId, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } },
    });
    if (overlapping) throw conflict('BLOCKED_PERIOD_OVERLAP');
    return this.db.blockedPeriod.create({
      data: { teacherId, startsAt, endsAt, reason: data.reason?.trim() || null, adminCreated },
    });
  }

  async deleteBlock(userId: string, id: string, staff = false) {
    const where = staff ? { id } : { id, teacher: { userId } };
    const result = await this.db.blockedPeriod.deleteMany({ where });
    if (!result.count) throw notFound('BLOCKED_PERIOD_NOT_FOUND');
    return { ok: true };
  }

  async slots(teacherId: string, from: Date, to: Date, type: SlotType = 'regular'): Promise<AvailabilitySlot[]> {
    this.validateRange(from, to);
    const { firstBookable, lastBookable } = await this.bookableWindow();
    const priceField = type === 'trial' ? 'approvedTrialPrice' : 'approvedRegularPrice';
    const teacher = await this.db.teacher.findFirst({
      where: { id: teacherId, status: 'APPROVED', [priceField]: { not: null } },
      include: {
        availabilityRules: { where: { active: true } },
        availabilityOverrides: {
          where: {
            date: { gte: utcDate(new Date(from.getTime() - DAY_MS)), lte: utcDate(new Date(to.getTime() + DAY_MS)) },
          },
        },
        blockedPeriods: { where: { startsAt: { lt: to }, endsAt: { gt: from } } },
        bookings: {
          where: { startsAt: { lt: to }, endsAt: { gt: from }, status: { in: ['PENDING_PAYMENT', 'CONFIRMED'] } },
        },
      },
    });
    if (!teacher) throw notFound('TEACHER_NOT_BOOKABLE');
    return this.computeSlots({ ...teacher, from, to, type, firstBookable, lastBookable });
  }

  /**
   * Batched form of {@link slots} for many teachers at once (the matching
   * questionnaire's up-to-40-candidate scoring pass — PERF-306). A single
   * per-teacher `slots()` call re-fetches the teacher row plus four relations
   * per candidate; here the two global settings and the three per-teacher
   * relations are each fetched once across every candidate (5 queries total,
   * regardless of candidate count) instead of once per candidate. Candidates
   * must already carry their own scalar fields and active `availabilityRules`
   * (the matching questionnaire's initial teacher query already selects
   * these), since re-fetching the teacher row itself would defeat the point.
   */
  async slotsForCandidates(
    candidates: AvailabilityCandidate[],
    from: Date,
    to: Date,
    type: SlotType = 'regular',
  ): Promise<Map<string, AvailabilitySlot[]>> {
    this.validateRange(from, to);
    const result = new Map<string, AvailabilitySlot[]>();
    if (!candidates.length) return result;
    const { firstBookable, lastBookable } = await this.bookableWindow();
    const teacherIds = candidates.map((candidate) => candidate.id);
    const [overrides, blockedPeriods, bookings] = await Promise.all([
      this.db.availabilityOverride.findMany({
        where: {
          teacherId: { in: teacherIds },
          date: { gte: utcDate(new Date(from.getTime() - DAY_MS)), lte: utcDate(new Date(to.getTime() + DAY_MS)) },
        },
      }),
      this.db.blockedPeriod.findMany({
        where: { teacherId: { in: teacherIds }, startsAt: { lt: to }, endsAt: { gt: from } },
      }),
      this.db.booking.findMany({
        where: {
          teacherId: { in: teacherIds },
          startsAt: { lt: to },
          endsAt: { gt: from },
          status: { in: ['PENDING_PAYMENT', 'CONFIRMED'] },
        },
      }),
    ]);
    const overridesByTeacher = groupByTeacherId(overrides);
    const blockedPeriodsByTeacher = groupByTeacherId(blockedPeriods);
    const bookingsByTeacher = groupByTeacherId(bookings);
    for (const candidate of candidates) {
      result.set(
        candidate.id,
        this.computeSlots({
          ...candidate,
          availabilityOverrides: overridesByTeacher.get(candidate.id) ?? [],
          blockedPeriods: blockedPeriodsByTeacher.get(candidate.id) ?? [],
          bookings: bookingsByTeacher.get(candidate.id) ?? [],
          from,
          to,
          type,
          firstBookable,
          lastBookable,
        }),
      );
    }
    return result;
  }

  private async bookableWindow() {
    const [minLeadMinutes, maxAdvanceDays] = await Promise.all([
      this.settings.numeric('booking.minLeadMinutes', 120, 10_080),
      this.settings.numeric('booking.maxAdvanceDays', 60, 730),
    ]);
    return {
      firstBookable: new Date(Date.now() + minLeadMinutes * 60_000),
      lastBookable: new Date(Date.now() + maxAdvanceDays * DAY_MS),
    };
  }

  private computeSlots(params: {
    trialDuration: number;
    lessonDuration: number;
    breakMinutes: number;
    availabilityRules: AvailabilityRuleRow[];
    availabilityOverrides: AvailabilityOverride[];
    blockedPeriods: Array<Pick<BlockedPeriod, 'startsAt' | 'endsAt'>>;
    bookings: Array<Pick<Booking, 'startsAt' | 'endsAt'>>;
    from: Date;
    to: Date;
    type: SlotType;
    firstBookable: Date;
    lastBookable: Date;
  }): AvailabilitySlot[] {
    const { from, to, type, firstBookable, lastBookable, blockedPeriods, bookings } = params;
    const duration = type === 'trial' ? params.trialDuration : params.lessonDuration;
    const timezone = params.availabilityRules[0]?.timezone ?? 'Asia/Tehran';
    const overrides = new Map(params.availabilityOverrides.map((row) => [dateKey(row.date), row]));
    const result: AvailabilitySlot[] = [];
    const firstLocalDay = utcDate(zonedDateKey(from, timezone));
    const lastLocalDay = utcDate(zonedDateKey(new Date(to.getTime() - 1), timezone));
    for (let cursor = firstLocalDay; cursor <= lastLocalDay; cursor = new Date(cursor.getTime() + DAY_MS)) {
      const day = dateKey(cursor);
      const override = overrides.get(day);
      const weekday = cursor.getUTCDay();
      const rules = override
        ? override.available && override.startMinute != null && override.endMinute != null
          ? [
              {
                startMinute: override.startMinute,
                endMinute: override.endMinute,
                timezone,
                lessonDuration: duration,
                breakMinutes: params.breakMinutes,
              },
            ]
          : []
        : params.availabilityRules.filter((rule) => rule.weekday === weekday);
      for (const rule of rules) {
        const stepDuration = duration;
        const breakMinutes = rule.breakMinutes ?? params.breakMinutes;
        for (
          let minute = rule.startMinute;
          minute + stepDuration <= rule.endMinute;
          minute += stepDuration + breakMinutes
        ) {
          const startsAt = localInstant(day, minute, rule.timezone);
          const endsAt = new Date(startsAt.getTime() + stepDuration * 60_000);
          // Public availability must apply the same booking window as
          // BookingsService.create; otherwise the UI offers a slot that the
          // booking endpoint immediately rejects.
          if (startsAt < from || endsAt > to || startsAt < firstBookable || startsAt > lastBookable) continue;
          if (this.overlapsAny(startsAt, endsAt, blockedPeriods) || this.overlapsAny(startsAt, endsAt, bookings))
            continue;
          result.push({
            startsAt: startsAt.toISOString(),
            endsAt: endsAt.toISOString(),
            date: day,
            timezone: rule.timezone,
            type,
          });
        }
      }
    }
    return result.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }

  async assertSlotAvailable(
    client: DbClient,
    teacherId: string,
    startsAt: Date,
    type: SlotType,
    ignoreBookingId?: string,
  ) {
    const priceField = type === 'trial' ? 'approvedTrialPrice' : 'approvedRegularPrice';
    const teacher = await client.teacher.findFirst({
      where: { id: teacherId, status: 'APPROVED', [priceField]: { not: null } },
      include: { availabilityRules: { where: { active: true } }, policy: true },
    });
    if (!teacher) throw notFound('TEACHER_NOT_BOOKABLE');
    const duration = type === 'trial' ? teacher.trialDuration : teacher.lessonDuration;
    const endsAt = new Date(startsAt.getTime() + duration * 60_000);
    const timezone = teacher.availabilityRules[0]?.timezone ?? 'Asia/Tehran';
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(startsAt);
    const value = (kind: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === kind)?.value ?? '';
    const localDay = `${value('year')}-${value('month')}-${value('day')}`;
    const minute = Number(value('hour')) * 60 + Number(value('minute'));
    const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weekday = weekdayNames.indexOf(value('weekday'));
    const override = await client.availabilityOverride.findUnique({
      where: { teacherId_date: { teacherId, date: utcDate(localDay) } },
    });
    const rangeAllowed = override
      ? override.available &&
        override.startMinute != null &&
        override.endMinute != null &&
        minute >= override.startMinute &&
        minute + duration <= override.endMinute
      : teacher.availabilityRules.some(
          (rule) =>
            rule.weekday === weekday &&
            rule.timezone === timezone &&
            minute >= rule.startMinute &&
            minute + duration <= rule.endMinute &&
            (minute - rule.startMinute) % (duration + (rule.breakMinutes ?? teacher.breakMinutes)) === 0,
        );
    if (!rangeAllowed) throw conflict('SLOT_OUTSIDE_AVAILABILITY');
    const blocked = await client.blockedPeriod.count({
      where: { teacherId, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } },
    });
    if (blocked) throw conflict('SLOT_BLOCKED_BY_TEACHER');
    const booked = await client.booking.count({
      where: {
        ...(ignoreBookingId ? { id: { not: ignoreBookingId } } : {}),
        teacherId,
        status: { in: ['PENDING_PAYMENT', 'CONFIRMED'] },
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
    });
    if (booked) throw conflict('SLOT_ALREADY_BOOKED');
    return { teacher, endsAt };
  }

  private validateRange(from: Date, to: Date) {
    if (
      !Number.isFinite(from.getTime()) ||
      !Number.isFinite(to.getTime()) ||
      to <= from ||
      to.getTime() - from.getTime() > 31 * DAY_MS
    ) {
      throw badRequest('AVAILABILITY_RANGE_INVALID');
    }
  }

  private overlapsAny(startsAt: Date, endsAt: Date, rows: Array<Pick<BlockedPeriod, 'startsAt' | 'endsAt'>>) {
    return rows.some((row) => row.startsAt < endsAt && row.endsAt > startsAt);
  }
}
