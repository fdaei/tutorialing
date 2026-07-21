import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { badRequest } from '../../common/errors';
import { AvailabilityService } from '../bookings/availability.service';

type MatchInput = {
  languageId: string;
  currentLevel?: string;
  learningGoal: string;
  targetLevel?: string;
  targetBand?: number;
  currentBand?: number;
  examDate?: string;
  weakSkills: string[];
  budget: number;
  suitableDays: number[];
  preferredTime?: string;
  preferredTeacherGender?: string;
  trialRequired: boolean;
  classType: string;
  availability?: object;
  timezone: string;
};

@Injectable()
export class MatchingService {
  constructor(private db: PrismaService, private availability: AvailabilityService) {}

  async create(userId: string, data: MatchInput) {
    const language = await this.db.language.findFirst({ where: { id: data.languageId, active: true } });
    if (!language) throw badRequest('MATCH_LANGUAGE_INVALID', 'زبان آموزشی انتخاب‌شده فعال یا معتبر نیست.', 'The selected educational language is invalid or inactive.', { languageId: { fa: 'یک زبان فعال از فهرست انتخاب کنید.', en: 'Choose an active language from the list.' } });
    const now = new Date(), to = new Date(now.getTime() + 31 * 86_400_000);
    const priceField = data.trialRequired ? 'approvedTrialPrice' : 'approvedRegularPrice';
    const teachers = await this.db.teacher.findMany({
      where: {
        status: 'APPROVED',
        [priceField]: { not: null, lte: data.budget },
        languageLinks: { some: { languageId: data.languageId, active: true } },
        availabilityRules: { some: { active: true, ...(data.suitableDays.length ? { weekday: { in: data.suitableDays } } : {}) } },
        ...(data.preferredTeacherGender ? { gender: data.preferredTeacherGender } : {}),
      },
      include: {
        languageLinks: { where: { languageId: data.languageId, active: true }, include: { language: true } },
        availabilityRules: { where: { active: true } },
      },
      take: 40,
    });
    const candidates = [];
    for (const teacher of teachers) {
      const slots = await this.availability.slots(teacher.id, now, to, data.trialRequired ? 'trial' : 'regular');
      const suitableSlots = slots.filter((slot) => {
        const local = new Date(slot.startsAt);
        const weekday = Number(new Intl.DateTimeFormat('en-US', { timeZone: data.timezone, weekday: 'short' }).formatToParts(local).find((part) => part.type === 'weekday')?.value ? ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(new Intl.DateTimeFormat('en-US', { timeZone: data.timezone, weekday: 'short' }).format(local)) : -1);
        if (data.suitableDays.length && !data.suitableDays.includes(weekday)) return false;
        if (!data.preferredTime) return true;
        const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: data.timezone, hour: '2-digit', hourCycle: 'h23' }).format(local));
        if (data.preferredTime === 'morning') return hour >= 6 && hour < 12;
        if (data.preferredTime === 'afternoon') return hour >= 12 && hour < 18;
        if (data.preferredTime === 'evening') return hour >= 18 && hour < 23;
        return true;
      });
      if (!suitableSlots.length) continue;
      const languageLink = teacher.languageLinks[0];
      const skillHits = [...new Set([...teacher.specialties, ...(languageLink?.specialties ?? [])])].filter((skill) => data.weakSkills.includes(skill));
      const targetLevelHit = !!data.targetLevel && (languageLink?.levels ?? []).includes(data.targetLevel);
      const price = data.trialRequired ? teacher.approvedTrialPrice! : teacher.approvedRegularPrice!;
      const score = Math.min(100,
        28 +
        skillHits.length * 14 +
        (targetLevelHit ? 12 : 0) +
        Math.min(20, teacher.rating * 4) +
        Math.min(12, suitableSlots.length) +
        Math.round((1 - price / Math.max(1, data.budget)) * 10)
      );
      const reasonsFa = [
        `مدرس تأییدشده زبان ${language.nativeName}`,
        skillHits.length ? `متخصص در مهارت‌های ضعیف شما: ${skillHits.join('، ')}` : '',
        targetLevelHit ? `سابقه تدریس سطح هدف ${data.targetLevel}` : '',
        `دارای ${suitableSlots.length} نوبت سازگار در ۳۱ روز آینده`,
        `قیمت ${price.toLocaleString('fa-IR')} در محدوده بودجه شما`,
      ].filter(Boolean);
      const reasonsEn = [
        `Verified ${language.nativeName} teacher`,
        skillHits.length ? `Matches weak skills: ${skillHits.join(', ')}` : '',
        targetLevelHit ? `Teaches target level ${data.targetLevel}` : '',
        `${suitableSlots.length} compatible slot(s) in the next 31 days`,
        `Price ${price.toLocaleString('en-US')} is within budget`,
      ].filter(Boolean);
      candidates.push({
        teacherId: teacher.id, score: Math.round(score), reasons: { fa: reasonsFa, en: reasonsEn },
        audit: { languageId: data.languageId, skillHits, targetLevelHit, rating: teacher.rating, price, compatibleSlots: suitableSlots.length, firstSlot: suitableSlots[0] },
      });
    }
    const ranked = candidates.sort((a, b) => b.score - a.score).slice(0, 3);
    return this.db.matchingSession.create({
      data: {
        userId, languageId: data.languageId, currentLevel: data.currentLevel, learningGoal: data.learningGoal,
        targetLevel: data.targetLevel, targetBand: data.targetBand ?? 0, currentBand: data.currentBand,
        examDate: data.examDate ? new Date(data.examDate) : undefined, weakSkills: data.weakSkills,
        maxTrialPrice: data.budget, availability: data.availability ?? { suitableDays: data.suitableDays, preferredTime: data.preferredTime },
        suitableDays: data.suitableDays, preferredTime: data.preferredTime, preferredTeacherGender: data.preferredTeacherGender,
        trialRequired: data.trialRequired, classType: data.classType, timezone: data.timezone,
        recommendations: { create: ranked.map((row, index) => ({ ...row, rank: index + 1 })) },
      },
      include: {
        language: true,
        recommendations: {
          include: { teacher: { select: { id: true, slug: true, nameFa: true, nameEn: true, rating: true, reviewsCount: true, approvedTrialPrice: true, approvedRegularPrice: true, trialDuration: true, lessonDuration: true, specialties: true, languageLinks: { where: { languageId: data.languageId }, include: { language: true } } } } },
          orderBy: { rank: 'asc' },
        },
      },
    });
  }

  history(userId: string) {
    return this.db.matchingSession.findMany({
      where: { userId }, include: { language: true, recommendations: { include: { teacher: { include: { languageLinks: { include: { language: true } } } } }, orderBy: { rank: 'asc' } } }, orderBy: { createdAt: 'desc' },
    });
  }
}
