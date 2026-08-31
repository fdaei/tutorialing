import { Footer, Header } from '@/components/layout/site';
import { publicApi } from '@/shared/services/api';
import type { Course } from '@/lib/marketplace-data';
import { BookOpen } from 'lucide-react';
import { CourseDirectory } from '@/features/courses/components/course-directory';
export const dynamic = 'force-dynamic';
export default async function CoursesPage() {
  const courses = await publicApi<Course[]>('/courses');
  return (
    <>
      <Header />
      <main className="page-shell section-space">
        <p className="text-sm font-black text-purple">یادگیری ساختاریافته</p>
        <h1 className="mt-3 text-4xl font-black md:text-5xl">دوره‌های زبان</h1>
        <p className="mt-4 max-w-2xl leading-8 text-muted">
          مسیرهای آموزشی منظم، با امتیازهای واقعی زبان‌آموزانی که در دوره شرکت کرده‌اند.
        </p>
        {courses.length ? (
          <CourseDirectory courses={courses} />
        ) : (
          <div className="review-empty mt-10">
            <BookOpen />
            <strong>دوره‌ای برای نمایش پیدا نشد</strong>
            <p>کمی بعد دوباره تلاش کنید.</p>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
