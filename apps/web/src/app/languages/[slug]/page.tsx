import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CourseCard } from '@/components/marketplace/cards';
import { Footer, Header } from '@/components/layout/site';
import { publicApi } from '@/shared/services/api';
import type { EducationalLanguage } from '@/features/languages';
import type { Course } from '@/lib/marketplace-data';
import { requestLocale } from '@/lib/server-locale';
import { localized } from '@/lib/i18n';

const legacyCodes: Record<string, string> = { english: 'en', german: 'de', french: 'fr', spanish: 'es' };

export default async function LanguagePage({ params }: { params: Promise<{ slug: string }> }) {
  const [{ slug }, languages, allCourses, locale] = await Promise.all([
    params,
    publicApi<EducationalLanguage[]>('/languages'),
    publicApi<Course[]>('/courses'),
    requestLocale(),
  ]);
  const code = legacyCodes[slug] ?? slug;
  const language = languages.find((item) => item.code === code);
  if (!language) notFound();
  const name = localized({ fa: language.nameFa, en: language.nameEn }, locale);
  const courses = allCourses.filter((course) => course.language === language.nameFa || course.language === language.nameEn);
  return (
    <>
      <Header />
      <main>
        <section className="hero-wash section-space">
          <div className="page-shell">
            <span className="text-5xl" role="img" aria-label={name}>{language.flag || '🌐'}</span>
            <p className="latin mt-4 text-sm text-purple">{language.nativeName}</p>
            <h1 className="mt-2 text-4xl font-black md:text-5xl">یادگیری زبان {name}</h1>
            <p className="mt-5 max-w-2xl leading-8 text-muted">
              با تعیین سطح، دوره‌های ساختاریافته و مدرس خصوصی، مسیر {name} را با برنامه‌ای روشن آغاز کنید.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/placement" className="brand-gradient inline-flex rounded-xl px-7 py-4 font-black text-white">
                شروع تعیین سطح رایگان
              </Link>
              <Link href="/teachers" className="inline-flex rounded-xl border hairline bg-white px-7 py-4 font-black text-purple">
                پیدا کردن مدرس
              </Link>
            </div>
          </div>
        </section>
        <section className="page-shell section-space">
          <h2 className="text-3xl font-black">دوره‌های زبان {name}</h2>
          {courses.length ? (
            <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {courses.map((course) => <CourseCard key={course.slug} course={course} />)}
            </div>
          ) : (
            <div className="review-empty mt-8">
              <strong>هنوز دوره‌ای برای این زبان منتشر نشده است</strong>
              <p>می‌توانید تعیین سطح را انجام دهید یا مدرس‌های موجود را بررسی کنید.</p>
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
