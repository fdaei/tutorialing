import { localePath, type Locale } from '@/lib/i18n';

export function placementRecommendationPaths(languageCode: string, level: string, locale: Locale) {
  const languageQuery = languageCode ? `language=${encodeURIComponent(languageCode)}&` : '';
  const teacherQuery = languageCode ? `?language=${encodeURIComponent(languageCode)}` : '';
  return {
    courses: `${localePath('/courses', locale)}?${languageQuery}level=${encodeURIComponent(level)}`,
    teachers: `${localePath('/teachers', locale)}${teacherQuery}`,
  };
}
