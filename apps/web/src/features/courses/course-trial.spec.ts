import type { Course } from '@/lib/marketplace-data';
import { courseMatchesLevel, trialSessionFor } from './course-trial';

const base: Course = {
  slug: 'term',
  language: 'انگلیسی',
  level: 'A1–C1',
  rating: 0,
  price: 8_280_000,
  image: null,
  teacherId: 'teacher-a',
  delivery: 'ONLINE',
  category: 'private-class',
};

describe('trialSessionFor', () => {
  const trial: Course = { ...base, slug: 'trial', price: 552_000, category: 'single-session' };
  const otherTeacher: Course = { ...trial, slug: 'other', teacherId: 'teacher-b' };
  const inPerson: Course = { ...trial, slug: 'in-person', delivery: 'IN_PERSON' };

  it('pairs a term class with the same teacher, language, level and delivery trial session', () => {
    expect(trialSessionFor(base, [otherTeacher, inPerson, trial, base])).toBe(trial);
  });

  it('offers no trial for non-class courses or when none matches', () => {
    expect(trialSessionFor(trial, [trial])).toBeUndefined();
    expect(trialSessionFor({ ...base, category: 'mentoring' }, [trial])).toBeUndefined();
    expect(trialSessionFor(base, [otherTeacher, inPerson])).toBeUndefined();
  });
});

describe('courseMatchesLevel', () => {
  it('matches exact, multi-level and all-level courses', () => {
    expect(courseMatchesLevel('B1', 'B1')).toBe(true);
    expect(courseMatchesLevel('A1–C1', 'B2')).toBe(true);
    expect(courseMatchesLevel('A1–C1', 'C2')).toBe(false);
    expect(courseMatchesLevel('All levels', 'C2')).toBe(true);
    expect(courseMatchesLevel('IELTS', 'B1')).toBe(false);
    expect(courseMatchesLevel('IELTS', '')).toBe(true);
  });
});
