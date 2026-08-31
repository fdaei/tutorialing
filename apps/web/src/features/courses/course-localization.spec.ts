import { localizedCourseLanguage } from './course-localization';

describe('localizedCourseLanguage', () => {
  it('uses the canonical English name for every active Persian course language', () => {
    expect(localizedCourseLanguage('انگلیسی', 'en')).toBe('English');
    expect(localizedCourseLanguage('کره‌ای', 'en')).toBe('Korean');
    expect(localizedCourseLanguage('روسی', 'en')).toBe('Russian');
  });

  it('preserves Persian and unknown future language values', () => {
    expect(localizedCourseLanguage('آلمانی', 'fa')).toBe('آلمانی');
    expect(localizedCourseLanguage('Esperanto', 'en')).toBe('Esperanto');
  });
});
