import { MatchingService } from './matching.service';

describe('MatchingService', () => {
  it('persists only the best three compatible recommendations', async () => {
    const teachers = [
      { id: 'a', specialties: ['writing'], approvedTrialPrice: 200, approvedRegularPrice: 300, rating: 5, languageLinks: [{ specialties: ['writing'], levels: ['B2'] }], availabilityRules: [{ weekday: 1 }] },
      { id: 'b', specialties: ['reading'], approvedTrialPrice: 200, approvedRegularPrice: 300, rating: 4, languageLinks: [{ specialties: ['reading'], levels: ['B2'] }], availabilityRules: [{ weekday: 1 }] },
      { id: 'c', specialties: ['speaking'], approvedTrialPrice: 250, approvedRegularPrice: 350, rating: 4, languageLinks: [{ specialties: ['speaking'], levels: ['C1'] }], availabilityRules: [{ weekday: 1 }] },
      { id: 'd', specialties: [], approvedTrialPrice: 250, approvedRegularPrice: 350, rating: 3, languageLinks: [{ specialties: [], levels: ['A2'] }], availabilityRules: [{ weekday: 1 }] },
    ];
    const create = jest.fn(({ data }) => data);
    const db = {
      language: { findFirst: jest.fn().mockResolvedValue({ id: 'lang-en', nativeName: 'English' }) },
      teacher: { findMany: jest.fn().mockResolvedValue(teachers) },
      matchingSession: { create },
    } as any;
    const availability = { slots: jest.fn().mockResolvedValue([{ startsAt: '2026-07-20T15:00:00.000Z' }]) } as any;
    const result: any = await new MatchingService(db, availability).create('student', {
      languageId: 'lang-en',
      currentLevel: 'B1',
      learningGoal: 'IELTS',
      targetLevel: 'B2',
      weakSkills: ['writing'],
      budget: 300,
      suitableDays: [],
      preferredTime: undefined,
      trialRequired: true,
      classType: 'private',
      timezone: 'Asia/Tehran',
    });
    expect(result.recommendations.create).toHaveLength(3);
    expect(result.recommendations.create[0].teacherId).toBe('a');
    expect(create).toHaveBeenCalledTimes(1);
  });
});
