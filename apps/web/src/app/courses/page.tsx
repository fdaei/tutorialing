import { Footer, Header, PublicPageHero } from '@/components/layout/site';
import { publicApi } from '@/shared/services/api';
import type { Course } from '@/lib/marketplace-data';
import { BookOpen } from 'lucide-react';
import { CourseDirectory } from '@/features/courses/components/course-directory';
import { requestLocale } from '@/lib/server-locale';
import { resolveHeaderConfig } from '@/lib/header-config';
import type { EducationalLanguage } from '@/features/languages';
export const dynamic = 'force-dynamic';
export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ language?: string; level?: string }>;
}) {
  const query = await searchParams;
  const requestedLanguage = query.language?.trim() ?? '';
  const [courses, locale, languages, headerConfig] = await Promise.all([
    publicApi<Course[]>('/courses'),
    requestLocale(),
    requestedLanguage
      ? publicApi<EducationalLanguage[]>('/languages').catch(() => [] as EducationalLanguage[])
      : Promise.resolve([] as EducationalLanguage[]),
    resolveHeaderConfig(),
  ]);
  const language = languages.find((item) => item.code === requestedLanguage || item.id === requestedLanguage);
  const languageCandidates = [
    requestedLanguage,
    language?.code,
    language?.nameFa,
    language?.nameEn,
    language?.nativeName,
  ].filter((item): item is string => Boolean(item));
  const initialLanguage = courses.find((course) => languageCandidates.includes(course.language))?.language ?? '';
  const initialLevel = /^(?:A1|A2|B1|B2|C1|C2)$/.test(query.level ?? '') ? (query.level ?? '') : '';
  const english = locale === 'en';
  return (
    <>
      <Header config={headerConfig} />
      <main className="page-shell section-space">
        <PublicPageHero
          eyebrow={english ? 'Structured learning' : 'یادگیری ساختاریافته'}
          title={
            english
              ? 'Find the course that matches your next goal.'
              : 'دوره‌ای را پیدا کن که با هدف بعدی تو هماهنگ است.'
          }
          description={
            english
              ? 'Compare level, format, teacher and real learner feedback—then start with a route you can confidently complete.'
              : 'سطح، شیوه برگزاری، مدرس و بازخورد زبان‌آموزان را مقایسه کن و با مسیری شروع کن که می‌توانی با اطمینان ادامه بدهی.'
          }
        />
        {courses.length ? (
          <CourseDirectory courses={courses} initialLanguage={initialLanguage} initialLevel={initialLevel} />
        ) : (
          <div className="review-empty mt-10">
            <BookOpen />
            <strong>{english ? 'No courses are available yet' : 'دوره‌ای برای نمایش پیدا نشد'}</strong>
            <p>
              {english
                ? 'Published courses will appear here when they become available.'
                : 'دوره‌های منتشرشده پس از آماده‌شدن در اینجا نمایش داده می‌شوند.'}
            </p>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
