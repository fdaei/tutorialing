import Image from 'next/image';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BookOpen, Check, ChevronLeft, Clock3, FileText, GraduationCap, PlayCircle, Star } from 'lucide-react';
import { Footer, Header } from '@/components/layout/site';
import { CourseCard } from '@/components/marketplace/cards';
import { ReviewSection, type PublicReview } from '@/components/reviews/review-section';
import type { Course } from '@/lib/marketplace-data';
import { ApiError, publicApi } from '@/shared/services/api';
import { publicPageMetadata } from '@/lib/public-metadata';
import { requestLocale } from '@/lib/server-locale';
import { formatNumber, localePath, localized } from '@/lib/i18n';
import { localizedCourseLanguage } from '@/features/courses/course-localization';
import { CourseEnrollmentCta } from '@/features/courses/components/course-enrollment-cta';
import type { CourseChapter } from '@/features/courses/course-types';

export const dynamic = 'force-dynamic';
type CourseDetail = Course & {
  id: string;
  reviews: PublicReview[];
  distribution: Record<string, number>;
  chapters: CourseChapter[];
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  try {
    const course = await publicApi<CourseDetail>(`/courses/${slug}`);
    const title = course.titleFa ?? course.title ?? 'دوره زبان';
    const descriptionFa = course.descriptionFa || `اطلاعات، سرفصل‌ها و ثبت‌نام دوره ${title}`;
    const descriptionEn =
      course.descriptionEn || `Details, syllabus, and enrollment information for ${course.titleEn || title}`;
    return publicPageMetadata(
      `/courses/${slug}`,
      { fa: title, en: course.titleEn || title },
      { fa: descriptionFa, en: descriptionEn },
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return {};
    throw error;
  }
}

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const [{ slug }, locale] = await Promise.all([params, requestLocale()]);
  let course: CourseDetail;
  try {
    course = await publicApi<CourseDetail>(`/courses/${slug}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  const courses = await publicApi<Course[]>('/courses').catch(() => []);
  const related = courses.filter((item) => item.slug !== slug).slice(0, 3);
  const english = locale === 'en';
  const t = (fa: string, en: string) => (english ? en : fa);
  const title = (english ? course.titleEn : course.titleFa) ?? course.title ?? t('دوره زبان', 'Language course');
  const description = (english ? course.descriptionEn : course.descriptionFa) ?? '';
  const language = localizedCourseLanguage(course.language, locale);
  const lessons = course.lessonsCount ?? course.lessons ?? 0;
  const teacher = course.teacherName ?? course.teacher ?? t('تیم لینگواسپیک', 'LingoSpeak team');
  const outcomes = english
    ? [
        'Speak more fluently in real situations',
        'Practise with a clear purpose',
        'Receive regular feedback on what to improve',
        'Know what to learn next',
      ]
    : [
        'مکالمه روان‌تر در موقعیت‌های واقعی',
        'تمرین هدفمند بدون سردرگمی',
        'بازخورد منظم روی نقاط قابل بهبود',
        'مسیر روشن برای ادامه یادگیری',
      ];
  return (
    <>
      <Header />
      <main>
        <section className="course-hero">
          <div className="page-shell grid gap-8 py-10 lg:grid-cols-[1fr_410px] lg:py-12">
            <div className="self-center">
              <nav className="mb-5 flex items-center gap-2 text-xs text-white/60">
                <Link href={localePath('/courses', locale)}>{t('دوره‌ها', 'Courses')}</Link>
                <ChevronLeft className={english ? 'rotate-180' : undefined} size={14} />
                <span>{language}</span>
              </nav>
              <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold text-white">
                {language} · {t('سطح', 'Level')} {course.level}
              </span>
              <h1 className="mt-5 max-w-3xl text-4xl font-black leading-[1.35] text-white md:text-5xl">{title}</h1>
              <p className="mt-4 max-w-2xl text-base leading-8 text-white/70">{description}</p>
              <div className="mt-6 flex flex-wrap gap-5 text-sm text-white/80">
                <span className="flex items-center gap-2">
                  <Star className="fill-amber-400 text-amber-400" size={18} />
                  {course.reviewsCount
                    ? `${course.rating} ${t('امتیاز', 'rating')} (${formatNumber(course.reviewsCount, locale)} ${t('نظر', 'reviews')})`
                    : t('هنوز امتیازی ثبت نشده', 'No ratings yet')}
                </span>
                <span className="flex items-center gap-2">
                  <Clock3 size={18} />
                  {formatNumber(lessons, locale)} {t('درس', 'lessons')}
                </span>
              </div>
            </div>
            <div className="course-purchase-card">
              <div className="relative aspect-video overflow-hidden rounded-2xl bg-indigo-50">
                {course.image && (
                  <Image
                    src={course.image}
                    alt={t(`تصویر دوره ${title}`, `Course cover for ${title}`)}
                    fill
                    priority
                    sizes="410px"
                    className="object-cover"
                  />
                )}
              </div>
              <strong className="mt-5 block text-2xl">
                {formatNumber(course.price, locale)} {t('تومان', 'Toman')}
              </strong>
              <CourseEnrollmentCta slug={course.slug} />
              <ul className="mt-5 grid gap-3 text-sm text-muted">
                <li className="flex items-center gap-2">
                  <FileText size={17} />
                  {formatNumber(lessons, locale)} {t('درس و فایل تمرینی', 'lessons and practice materials')}
                </li>
              </ul>
            </div>
          </div>
        </section>
        <div className="page-shell grid gap-8 py-12 lg:grid-cols-[1fr_320px]">
          <div className="grid gap-8">
            <section className="surface-card p-6 md:p-8">
              <h2 className="text-2xl font-black">{t('در این دوره چه یاد می‌گیرید؟', 'What will you learn?')}</h2>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {outcomes.map((item) => (
                  <p key={item} className="flex items-start gap-3 text-sm leading-7">
                    <Check className="mt-1 shrink-0 text-green" size={19} />
                    {item}
                  </p>
                ))}
              </div>
            </section>
            <section>
              <p className="text-sm font-black text-purple">{t('برنامه دوره', 'Curriculum')}</p>
              <h2 className="mt-2 text-2xl font-black">{t('فصل‌ها و درس‌ها', 'Chapters and lessons')}</h2>
              <div className="mt-5 grid gap-3">
                {course.chapters.length ? (
                  course.chapters.map((chapter, chapterIndex) => (
                    <details key={chapter.id} open={chapterIndex === 0} className="surface-card group overflow-hidden">
                      <summary className="flex cursor-pointer list-none items-center gap-4 p-5">
                        <span className="grid size-10 place-items-center rounded-xl bg-lavender font-black text-purple">
                          {(chapterIndex + 1).toLocaleString(english ? 'en-US' : 'fa-IR')}
                        </span>
                        <strong className="flex-1">
                          {localized({ fa: chapter.titleFa, en: chapter.titleEn }, locale)}
                        </strong>
                        <ChevronLeft
                          className={`text-muted transition group-open:-rotate-90 ${english ? 'rotate-180' : ''}`}
                          size={18}
                        />
                      </summary>
                      <div className="border-t hairline bg-[#fbfbfe] px-5 py-2">
                        {chapter.lessons.map((lesson) => (
                          <div
                            key={lesson.id}
                            className="flex items-center gap-3 border-b hairline py-3 text-sm last:border-0"
                          >
                            <PlayCircle size={17} className="text-purple" />
                            <span className="flex-1">
                              {localized({ fa: lesson.titleFa, en: lesson.titleEn }, locale)}
                            </span>
                            <small className="text-muted">
                              {Math.max(1, Math.round(lesson.durationSeconds / 60)).toLocaleString(
                                english ? 'en-US' : 'fa-IR',
                              )}{' '}
                              {t('دقیقه', 'min')}
                            </small>
                          </div>
                        ))}
                      </div>
                    </details>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed hairline p-8 text-center text-muted">
                    {t('سرفصل دوره در حال تکمیل است.', 'The curriculum is being prepared.')}
                  </div>
                )}
              </div>
            </section>
            <section className="surface-card p-6 md:p-8">
              <p className="text-sm font-black text-purple">{t('درباره دوره', 'About this course')}</p>
              <h2 className="mt-2 text-2xl font-black">
                {t('یک مسیر منظم و قابل پیگیری', 'A structured route you can follow')}
              </h2>
              <p className="mt-4 leading-9 text-muted">{description}</p>
              <div className="mt-6 flex flex-wrap gap-3 text-sm">
                <span className="chip">
                  <BookOpen size={16} />
                  {formatNumber(lessons, locale)} {t('درس', 'lessons')}
                </span>
                <span className="chip latin">Level {course.level}</span>
              </div>
            </section>
          </div>
          <aside>
            <div className="surface-card p-6 lg:sticky lg:top-24">
              <p className="text-xs font-black text-purple">{t('مدرس دوره', 'Course teacher')}</p>
              <div className="mt-4 flex items-center gap-4">
                <span className="grid size-14 place-items-center rounded-full bg-lavender text-purple">
                  <GraduationCap />
                </span>
                <div>
                  <strong>{teacher}</strong>
                  <p className="mt-1 text-xs text-muted">
                    {t('مدرس', 'Teacher of')} {language}
                  </p>
                </div>
              </div>
              <p className="mt-5 text-sm leading-7 text-muted">
                {t(
                  'محتوا با تمرکز بر تمرین کاربردی و بازخورد روشن طراحی شده است.',
                  'The course focuses on practical exercises and clear feedback.',
                )}
              </p>
            </div>
          </aside>
        </div>
        <div className="page-shell pb-14">
          <ReviewSection
            subject="course"
            subjectId={course.id}
            title={t('امتیاز و نظرات دانشجویان', 'Learner ratings and reviews')}
            rating={course.rating}
            count={course.reviewsCount ?? 0}
            reviews={course.reviews}
            distribution={course.distribution}
          />
        </div>
        {related.length > 0 && (
          <section className="border-t hairline bg-white py-14">
            <div className="page-shell">
              <h2 className="text-2xl font-black">{t('دوره‌های مرتبط', 'Related courses')}</h2>
              <div className="mt-7 grid gap-5 md:grid-cols-3">
                {related.map((item) => (
                  <CourseCard key={item.slug} course={item} />
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
