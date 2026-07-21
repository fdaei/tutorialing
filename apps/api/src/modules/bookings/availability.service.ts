import { Injectable } from '@nestjs/common';
import { Prisma, type BlockedPeriod } from '@prisma/client';
import { fromZonedTime } from 'date-fns-tz';
import { PrismaService } from '../../prisma.service';
import { badRequest, conflict, notFound } from '../../common/errors';

type RuleInput = {
  weekday: number;
  startMinute: number;
  endMinute: number;
  timezone: string;
  lessonDuration?: number;
  breakMinutes?: number;
};

type SlotType = 'trial' | 'regular';
type DbClient = PrismaService | Prisma.TransactionClient;

const DAY_MS = 86_400_000;
const dateKey = (date: Date) => date.toISOString().slice(0, 10);
const zonedDateKey = (date: Date, timezone: string) => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
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

@Injectable()
export class AvailabilityService {
  constructor(private db: PrismaService) {}

  async mine(userId: string) {
    const teacher = await this.db.teacher.findUnique({ where: { userId } });
    if (!teacher) throw notFound('TEACHER_PROFILE_NOT_FOUND', 'پروفایل مدرس پیدا نشد.', 'Teacher profile was not found.');
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

  async setRules(userId: string, rules: RuleInput[]) {
    const teacher = await this.db.teacher.findUnique({ where: { userId } });
    if (!teacher) throw notFound('TEACHER_PROFILE_NOT_FOUND', 'پروفایل مدرس پیدا نشد.', 'Teacher profile was not found.');
    const normalized = rules.map((rule, index) => this.validateRule(rule, index));
    for (const weekday of new Set(normalized.map((rule) => rule.weekday))) {
      const rows = normalized.filter((rule) => rule.weekday === weekday).sort((a, b) => a.startMinute - b.startMinute);
      for (let i = 1; i < rows.length; i += 1) {
        if (rows[i]!.startMinute < rows[i - 1]!.endMinute) {
          throw conflict(
            'AVAILABILITY_RULE_OVERLAP',
            'دو بازه برنامه هفتگی با هم هم‌پوشانی دارند. زمان شروع یا پایان یکی از بازه‌ها را تغییر دهید.',
            'Two weekly availability ranges overlap. Change the start or end time of one range.',
            { rules: { fa: 'بازه‌های یک روز نباید روی هم قرار بگیرند.', en: 'Ranges on the same day must not overlap.' } },
          );
        }
      }
    }
    return this.db.$transaction(async (tx) => {
      await tx.availabilityRule.deleteMany({ where: { teacherId: teacher.id } });
      if (normalized.length) await tx.availabilityRule.createMany({ data: normalized.map((rule) => ({ ...rule, teacherId: teacher.id })) });
      return tx.availabilityRule.findMany({ where: { teacherId: teacher.id }, orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }] });
    });
  }

  private validateRule(rule: RuleInput, index: number) {
    const field = `rules.${index}`;
    if (!Number.isInteger(rule.weekday) || rule.weekday < 0 || rule.weekday > 6) {
      throw badRequest('AVAILABILITY_WEEKDAY_INVALID', 'روز هفته معتبر نیست.', 'The weekday is invalid.', {
        [`${field}.weekday`]: { fa: 'یک روز معتبر هفته را انتخاب کنید.', en: 'Choose a valid weekday.' },
      });
    }
    if (!Number.isInteger(rule.startMinute) || !Number.isInteger(rule.endMinute) || rule.startMinute < 0 || rule.endMinute > 1440) {
      throw badRequest('AVAILABILITY_TIME_INVALID', 'ساعت شروع یا پایان معتبر نیست.', 'The start or end time is invalid.', {
        [field]: { fa: 'ساعت را از انتخاب‌گر زمان انتخاب کنید.', en: 'Choose the time from the time picker.' },
      });
    }
    if (rule.startMinute >= rule.endMinute) {
      throw badRequest('AVAILABILITY_END_BEFORE_START', 'ساعت پایان باید بعد از ساعت شروع باشد.', 'The end time must be after the start time.', {
        [`${field}.endMinute`]: { fa: 'مثلاً اگر شروع 09:00 است، پایان را 10:00 یا دیرتر انتخاب کنید.', en: 'For example, when the start is 09:00, choose 10:00 or later.' },
      });
    }
    const lessonDuration = rule.lessonDuration ?? 60;
    const breakMinutes = rule.breakMinutes ?? 15;
    if (!Number.isInteger(lessonDuration) || lessonDuration < 15 || lessonDuration > 240) {
      throw badRequest('LESSON_DURATION_INVALID', 'مدت کلاس باید بین ۱۵ تا ۲۴۰ دقیقه باشد.', 'Lesson duration must be between 15 and 240 minutes.');
    }
    if (!Number.isInteger(breakMinutes) || breakMinutes < 0 || breakMinutes > 120) {
      throw badRequest('BREAK_DURATION_INVALID', 'فاصله بین کلاس‌ها باید بین صفر تا ۱۲۰ دقیقه باشد.', 'The break between lessons must be between 0 and 120 minutes.');
    }
    if (rule.endMinute - rule.startMinute < lessonDuration) {
      throw badRequest('AVAILABILITY_RANGE_TOO_SHORT', 'این بازه برای مدت کلاس انتخاب‌شده کوتاه است.', 'This range is shorter than the selected lesson duration.');
    }
    try { new Intl.DateTimeFormat('en-US', { timeZone: rule.timezone }).format(new Date()); }
    catch { throw badRequest('TIMEZONE_INVALID', 'منطقه زمانی معتبر نیست.', 'The timezone is invalid.'); }
    return { ...rule, lessonDuration, breakMinutes };
  }

  async addOverride(userId: string, data: { date: string; available: boolean; startMinute?: number; endMinute?: number; reason?: string }) {
    const teacher = await this.db.teacher.findUnique({ where: { userId } });
    if (!teacher) throw notFound('TEACHER_PROFILE_NOT_FOUND', 'پروفایل مدرس پیدا نشد.', 'Teacher profile was not found.');
    const date = utcDate(data.date);
    if (!Number.isFinite(date.getTime()) || date < utcDate(new Date())) {
      throw badRequest('AVAILABILITY_DATE_PAST', 'برای استثنا باید امروز یا یک تاریخ آینده را انتخاب کنید.', 'Choose today or a future date for an exception.', {
        date: { fa: 'تاریخ را از تقویم شمسی انتخاب کنید؛ تاریخ گذشته مجاز نیست.', en: 'Choose a date from the date picker; past dates are not allowed.' },
      });
    }
    if (data.available && (data.startMinute == null || data.endMinute == null || data.startMinute >= data.endMinute)) {
      throw badRequest('OVERRIDE_TIME_INVALID', 'برای روز آزاد، یک بازه زمانی معتبر تعیین کنید.', 'Set a valid time range for an available exception.', {
        endMinute: { fa: 'ساعت پایان باید بعد از ساعت شروع باشد.', en: 'The end time must be after the start time.' },
      });
    }
    return this.db.availabilityOverride.upsert({
      where: { teacherId_date: { teacherId: teacher.id, date } },
      create: { teacherId: teacher.id, date, available: data.available, startMinute: data.available ? data.startMinute : null, endMinute: data.available ? data.endMinute : null, reason: data.reason },
      update: { available: data.available, startMinute: data.available ? data.startMinute : null, endMinute: data.available ? data.endMinute : null, reason: data.reason },
    });
  }

  async deleteOverride(userId: string, id: string) {
    const result = await this.db.availabilityOverride.deleteMany({ where: { id, teacher: { userId } } });
    if (!result.count) throw notFound('AVAILABILITY_OVERRIDE_NOT_FOUND', 'استثنای زمانی پیدا نشد.', 'Availability exception was not found.');
    return { ok: true };
  }

  async addBlock(userId: string, data: { startsAt: string; endsAt: string; reason?: string }) {
    const teacher = await this.db.teacher.findUnique({ where: { userId } });
    if (!teacher) throw notFound('TEACHER_PROFILE_NOT_FOUND', 'پروفایل مدرس پیدا نشد.', 'Teacher profile was not found.');
    return this.createBlock(teacher.id, data, false);
  }

  async addAdminBlock(data: { teacherId?: string; startsAt: string; endsAt: string; reason?: string }) {
    if (!data.teacherId) throw badRequest('TEACHER_REQUIRED', 'مدرس را انتخاب کنید.', 'Select a teacher.', {
      teacherId: { fa: 'مدرس را با نام، موبایل یا ایمیل جستجو و انتخاب کنید.', en: 'Search for and select a teacher by name, phone, or email.' },
    });
    const exists = await this.db.teacher.count({ where: { id: data.teacherId } });
    if (!exists) throw notFound('TEACHER_NOT_FOUND', 'مدرس انتخاب‌شده پیدا نشد.', 'The selected teacher was not found.');
    return this.createBlock(data.teacherId, data, true);
  }

  private async createBlock(teacherId: string, data: { startsAt: string; endsAt: string; reason?: string }, adminCreated: boolean) {
    const startsAt = new Date(data.startsAt);
    const endsAt = new Date(data.endsAt);
    if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime())) {
      throw badRequest('BLOCKED_PERIOD_DATE_INVALID', 'تاریخ یا ساعت مسدودی معتبر نیست.', 'The blocked period date or time is invalid.');
    }
    if (startsAt >= endsAt) {
      throw badRequest('AVAILABILITY_END_BEFORE_START', 'ساعت پایان باید بعد از ساعت شروع باشد.', 'The end time must be after the start time.', {
        endsAt: { fa: 'مثلاً اگر شروع 09:00 است، پایان را 10:00 یا دیرتر انتخاب کنید.', en: 'For example, when the start is 09:00, choose 10:00 or later.' },
      });
    }
    if (endsAt <= new Date()) throw badRequest('BLOCKED_PERIOD_PAST', 'بازه گذشته را نمی‌توان مسدود کرد.', 'A past period cannot be blocked.');
    const overlapping = await this.db.blockedPeriod.findFirst({ where: { teacherId, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } } });
    if (overlapping) throw conflict('BLOCKED_PERIOD_OVERLAP', 'این بازه با یک مسدودی دیگر تداخل دارد.', 'This period overlaps another blocked period.');
    return this.db.blockedPeriod.create({ data: { teacherId, startsAt, endsAt, reason: data.reason?.trim() || null, adminCreated } });
  }

  async deleteBlock(userId: string, id: string, staff = false) {
    const where = staff ? { id } : { id, teacher: { userId } };
    const result = await this.db.blockedPeriod.deleteMany({ where });
    if (!result.count) throw notFound('BLOCKED_PERIOD_NOT_FOUND', 'بازه مسدودشده پیدا نشد یا اجازه حذف آن را ندارید.', 'The blocked period was not found or you cannot delete it.');
    return { ok: true };
  }

  async slots(teacherId: string, from: Date, to: Date, type: SlotType = 'regular') {
    this.validateRange(from, to);
    const priceField = type === 'trial' ? 'approvedTrialPrice' : 'approvedRegularPrice';
    const teacher = await this.db.teacher.findFirst({
      where: { id: teacherId, status: 'APPROVED', [priceField]: { not: null } },
      include: {
        availabilityRules: { where: { active: true } },
        availabilityOverrides: { where: { date: { gte: utcDate(new Date(from.getTime() - DAY_MS)), lte: utcDate(new Date(to.getTime() + DAY_MS)) } } },
        blockedPeriods: { where: { startsAt: { lt: to }, endsAt: { gt: from } } },
        bookings: { where: { startsAt: { lt: to }, endsAt: { gt: from }, status: { in: ['PENDING_PAYMENT', 'CONFIRMED'] } } },
      },
    });
    if (!teacher) throw notFound('TEACHER_NOT_BOOKABLE', 'این مدرس در حال حاضر برای رزرو فعال نیست.', 'This teacher is not currently available for booking.');
    const duration = type === 'trial' ? teacher.trialDuration : teacher.lessonDuration;
    const timezone = teacher.availabilityRules[0]?.timezone ?? 'Asia/Tehran';
    const overrides = new Map(teacher.availabilityOverrides.map((row) => [dateKey(row.date), row]));
    const result: { startsAt: string; endsAt: string; date: string; timezone: string; type: SlotType }[] = [];
    const firstLocalDay = utcDate(zonedDateKey(from, timezone));
    const lastLocalDay = utcDate(zonedDateKey(new Date(to.getTime() - 1), timezone));
    for (let cursor = firstLocalDay; cursor <= lastLocalDay; cursor = new Date(cursor.getTime() + DAY_MS)) {
      const day = dateKey(cursor);
      const override = overrides.get(day);
      const weekday = cursor.getUTCDay();
      const rules = override
        ? override.available && override.startMinute != null && override.endMinute != null
          ? [{ startMinute: override.startMinute, endMinute: override.endMinute, timezone, lessonDuration: duration, breakMinutes: teacher.breakMinutes }]
          : []
        : teacher.availabilityRules.filter((rule) => rule.weekday === weekday);
      for (const rule of rules) {
        const stepDuration = duration;
        const breakMinutes = rule.breakMinutes ?? teacher.breakMinutes;
        for (let minute = rule.startMinute; minute + stepDuration <= rule.endMinute; minute += stepDuration + breakMinutes) {
          const startsAt = localInstant(day, minute, rule.timezone);
          const endsAt = new Date(startsAt.getTime() + stepDuration * 60_000);
          if (startsAt < from || endsAt > to || startsAt <= new Date()) continue;
          if (this.overlapsAny(startsAt, endsAt, teacher.blockedPeriods) || this.overlapsAny(startsAt, endsAt, teacher.bookings)) continue;
          result.push({ startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), date: day, timezone: rule.timezone, type });
        }
      }
    }
    return result.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }

  async assertSlotAvailable(client: DbClient, teacherId: string, startsAt: Date, type: SlotType, ignoreBookingId?: string) {
    const priceField = type === 'trial' ? 'approvedTrialPrice' : 'approvedRegularPrice';
    const teacher = await client.teacher.findFirst({
      where: { id: teacherId, status: 'APPROVED', [priceField]: { not: null } },
      include: { availabilityRules: { where: { active: true } }, policy: true },
    });
    if (!teacher) throw notFound('TEACHER_NOT_BOOKABLE', 'این مدرس در حال حاضر برای رزرو فعال نیست.', 'This teacher is not currently available for booking.');
    const duration = type === 'trial' ? teacher.trialDuration : teacher.lessonDuration;
    const endsAt = new Date(startsAt.getTime() + duration * 60_000);
    const timezone = teacher.availabilityRules[0]?.timezone ?? 'Asia/Tehran';
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(startsAt);
    const value = (kind: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === kind)?.value ?? '';
    const localDay = `${value('year')}-${value('month')}-${value('day')}`;
    const minute = Number(value('hour')) * 60 + Number(value('minute'));
    const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weekday = weekdayNames.indexOf(value('weekday'));
    const override = await client.availabilityOverride.findUnique({ where: { teacherId_date: { teacherId, date: utcDate(localDay) } } });
    const rangeAllowed = override
      ? override.available && override.startMinute != null && override.endMinute != null && minute >= override.startMinute && minute + duration <= override.endMinute
      : teacher.availabilityRules.some((rule) => rule.weekday === weekday && rule.timezone === timezone && minute >= rule.startMinute && minute + duration <= rule.endMinute && (minute - rule.startMinute) % (duration + (rule.breakMinutes ?? teacher.breakMinutes)) === 0);
    if (!rangeAllowed) throw conflict('SLOT_OUTSIDE_AVAILABILITY', 'این ساعت در برنامه آزاد مدرس نیست. یک ساعت دیگر انتخاب کنید.', 'This time is outside the teacher’s availability. Choose another slot.');
    const blocked = await client.blockedPeriod.count({ where: { teacherId, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } } });
    if (blocked) throw conflict('SLOT_BLOCKED_BY_TEACHER', 'این بازه توسط مدرس مسدود شده است. یک ساعت دیگر انتخاب کنید.', 'This period is blocked by the teacher. Choose another slot.');
    const booked = await client.booking.count({ where: { ...(ignoreBookingId ? { id: { not: ignoreBookingId } } : {}), teacherId, status: { in: ['PENDING_PAYMENT', 'CONFIRMED'] }, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } } });
    if (booked) throw conflict('SLOT_ALREADY_BOOKED', 'این زمان لحظاتی قبل رزرو شده است. یک ساعت دیگر انتخاب کنید.', 'This slot was just booked. Choose another time.');
    return { teacher, endsAt };
  }

  private validateRange(from: Date, to: Date) {
    if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || to <= from || to.getTime() - from.getTime() > 31 * DAY_MS) {
      throw badRequest('AVAILABILITY_RANGE_INVALID', 'بازه دریافت نوبت معتبر نیست و حداکثر می‌تواند ۳۱ روز باشد.', 'The slot range is invalid and cannot exceed 31 days.');
    }
  }

  private overlapsAny(startsAt: Date, endsAt: Date, rows: Array<Pick<BlockedPeriod, 'startsAt' | 'endsAt'>>) {
    return rows.some((row) => row.startsAt < endsAt && row.endsAt > startsAt);
  }
}
