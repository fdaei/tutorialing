import type { Course } from '@/lib/marketplace-data';

/** Catalog category of the one-off trial session sold alongside each term class. */
export const SINGLE_SESSION_CATEGORY = 'single-session';
const TERM_CLASS_CATEGORY = 'private-class';

export const isSingleSessionCourse = (course: Pick<Course, 'category'>) =>
  course.category === SINGLE_SESSION_CATEGORY;

/** A CEFR level also matches the multi-level "A1–C1" and "All levels" courses that cover it. */
export function courseMatchesLevel(courseLevel: string, level: string) {
  return (
    !level ||
    courseLevel === level ||
    courseLevel === 'All levels' ||
    (courseLevel === 'A1–C1' && /^(?:A1|A2|B1|B2|C1)$/.test(level))
  );
}

/**
 * The trial session for a term class: the single-session course by the same
 * teacher for the same language, level and delivery. It is priced separately
 * from the term, so the class pages surface it instead of leaving it to be
 * found in the directory.
 */
export function trialSessionFor(course: Course, courses: Course[]) {
  if (course.category !== TERM_CLASS_CATEGORY || !course.teacherId) return undefined;
  return courses.find(
    (candidate) =>
      isSingleSessionCourse(candidate) &&
      candidate.teacherId === course.teacherId &&
      candidate.language === course.language &&
      candidate.level === course.level &&
      (candidate.delivery ?? null) === (course.delivery ?? null),
  );
}
