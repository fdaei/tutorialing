import { Footer, Header } from '@/components/layout/site';
import { publicApi } from '@/shared/services/api';
import type { Course } from '@/lib/marketplace-data';
import { BookOpen } from 'lucide-react';
import { CourseDirectory } from '@/features/courses/components/course-directory';
import { requestLocale } from '@/lib/server-locale';
export const dynamic = 'force-dynamic';
export default async function CoursesPage() {
  const [courses, locale] = await Promise.all([publicApi<Course[]>('/courses'), requestLocale()]);
  const english = locale === 'en';
  return (
    <>
      <Header />
      <main className="page-shell section-space">
        <p className="text-sm font-black text-purple">{english ? 'Structured learning' : 'یادگیری ساختاریافته'}</p>
        <h1 className="mt-3 text-4xl font-black md:text-5xl">{english ? 'Language courses' : 'دوره‌های زبان'}</h1>
        <p className="mt-4 max-w-2xl leading-8 text-muted">
          {english
            ? 'Follow a clear learning route, informed by ratings from learners who enrolled in each course.'
            : 'مسیرهای آموزشی منظم، با امتیازهای واقعی زبان‌آموزانی که در دوره شرکت کرده‌اند.'}
        </p>
        {courses.length ? (
          <CourseDirectory courses={courses} />
        ) : (
          <div className="review-empty mt-10">
            <BookOpen />
            <strong>{english ? 'No courses are available yet' : 'دوره‌ای برای نمایش پیدا نشد'}</strong>
            <p>{english ? 'Published courses will appear here when they become available.' : 'دوره‌های منتشرشده پس از آماده‌شدن در اینجا نمایش داده می‌شوند.'}</p>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
