import Image from 'next/image';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Award,
  BookOpen,
  Check,
  ChevronLeft,
  Clock3,
  FileText,
  GraduationCap,
  PlayCircle,
  ShieldCheck,
  Star,
} from 'lucide-react';
import { Footer, Header } from '@/components/layout/site';
import { CourseCard } from '@/components/marketplace/cards';
import { ReviewSection, type PublicReview } from '@/components/reviews/review-section';
import type { Course } from '@/lib/marketplace-data';
import { ApiError, publicApi } from '@/shared/services/api';
import { publicPageMetadata } from '@/lib/public-metadata';

export const dynamic = 'force-dynamic';
const outcomes = [
  'مکالمه روان‌تر در موقعیت‌های واقعی',
  'تمرین هدفمند بدون سردرگمی',
  'بازخورد منظم روی نقاط قابل بهبود',
  'مسیر روشن برای ادامه یادگیری',
];
type CourseDetail = Course & { id: string; reviews: PublicReview[]; distribution: Record<string, number> };

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  try {
    const course = await publicApi<CourseDetail>(`/courses/${slug}`);
    const title = course.titleFa ?? course.title ?? 'دوره زبان';
    const description = course.descriptionFa || `اطلاعات، سرفصل‌ها و ثبت‌نام دوره ${title}`;
    return publicPageMetadata(`/courses/${slug}`, { fa: title, en: course.titleEn || title }, { fa: description, en: description });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return {};
    throw error;
  }
}

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let course: CourseDetail;
  try {
    course = await publicApi<CourseDetail>(`/courses/${slug}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  const courses = await publicApi<Course[]>('/courses').catch(() => []);
  const related = courses.filter((item) => item.slug !== slug).slice(0, 3);
  const title = course.titleFa ?? course.title ?? 'دوره زبان';
  const lessons = course.lessonsCount ?? course.lessons ?? 0;
  const teacher = course.teacherName ?? course.teacher ?? 'تیم لینگواسپیک';
  return (
    <>
      <Header />
      <main>
        <section className="course-hero">
          <div className="page-shell grid gap-8 py-10 lg:grid-cols-[1fr_410px] lg:py-12">
            <div className="self-center">
              <nav className="mb-5 flex items-center gap-2 text-xs text-white/60">
                <Link href="/courses">دوره‌ها</Link>
                <ChevronLeft size={14} />
                <span>{course.language}</span>
              </nav>
              <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold text-white">
                {course.language} · سطح {course.level}
              </span>
              <h1 className="mt-5 max-w-3xl text-4xl font-black leading-[1.35] text-white md:text-5xl">{title}</h1>
              <p className="mt-4 max-w-2xl text-base leading-8 text-white/70">{course.descriptionFa}</p>
              <div className="mt-6 flex flex-wrap gap-5 text-sm text-white/80">
                <span className="flex items-center gap-2">
                  <Star className="fill-amber-400 text-amber-400" size={18} />
                  {course.reviewsCount
                    ? `${course.rating} امتیاز (${course.reviewsCount.toLocaleString('fa-IR')} نظر)`
                    : 'هنوز امتیازی ثبت نشده'}
                </span>
                <span className="flex items-center gap-2">
                  <Clock3 size={18} />
                  {lessons.toLocaleString('fa-IR')} درس
                </span>
              </div>
            </div>
            <div className="course-purchase-card">
              <div className="relative aspect-video overflow-hidden rounded-2xl bg-indigo-50">
                {course.image && (
                  <Image
                    src={course.image}
                    alt={`تصویر دوره ${title}`}
                    fill
                    priority
                    sizes="410px"
                    className="object-cover"
                  />
                )}
                <span className="absolute inset-0 grid place-items-center bg-navy/20">
                  <span className="grid size-16 place-items-center rounded-full bg-white text-purple shadow-xl">
                    <PlayCircle size={34} />
                  </span>
                </span>
              </div>
              <strong className="mt-5 block text-2xl">{course.price.toLocaleString('fa-IR')} تومان</strong>
              <Link
                href={`/auth?next=/courses/${course.slug}`}
                className="brand-gradient mt-4 flex min-h-13 items-center justify-center rounded-xl font-black text-white"
              >
                ثبت‌نام و شروع دوره
              </Link>
              <ul className="mt-5 grid gap-3 text-sm text-muted">
                <li className="flex items-center gap-2">
                  <ShieldCheck size={17} />
                  ضمانت بازگشت وجه تا ۷ روز
                </li>
                <li className="flex items-center gap-2">
                  <FileText size={17} />
                  {lessons.toLocaleString('fa-IR')} درس و فایل تمرینی
                </li>
                <li className="flex items-center gap-2">
                  <Award size={17} />
                  گواهی پایان دوره
                </li>
              </ul>
            </div>
          </div>
        </section>
        <div className="page-shell grid gap-8 py-12 lg:grid-cols-[1fr_320px]">
          <div className="grid gap-8">
            <section className="surface-card p-6 md:p-8">
              <h2 className="text-2xl font-black">در این دوره چه یاد می‌گیرید؟</h2>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {outcomes.map((item) => (
                  <p key={item} className="flex items-start gap-3 text-sm leading-7">
                    <Check className="mt-1 shrink-0 text-green" size={19} />
                    {item}
                  </p>
                ))}
              </div>
            </section>
            <section className="surface-card p-6 md:p-8">
              <p className="text-sm font-black text-purple">درباره دوره</p>
              <h2 className="mt-2 text-2xl font-black">یک مسیر منظم و قابل پیگیری</h2>
              <p className="mt-4 leading-9 text-muted">{course.descriptionFa}</p>
              <div className="mt-6 flex flex-wrap gap-3 text-sm">
                <span className="chip">
                  <BookOpen size={16} />
                  {lessons.toLocaleString('fa-IR')} درس
                </span>
                <span className="chip latin">Level {course.level}</span>
              </div>
            </section>
          </div>
          <aside>
            <div className="surface-card p-6 lg:sticky lg:top-24">
              <p className="text-xs font-black text-purple">مدرس دوره</p>
              <div className="mt-4 flex items-center gap-4">
                <span className="grid size-14 place-items-center rounded-full bg-lavender text-purple">
                  <GraduationCap />
                </span>
                <div>
                  <strong>{teacher}</strong>
                  <p className="mt-1 text-xs text-muted">مدرس {course.language}</p>
                </div>
              </div>
              <p className="mt-5 text-sm leading-7 text-muted">
                محتوا با تمرکز بر تمرین کاربردی و بازخورد روشن طراحی شده است.
              </p>
            </div>
          </aside>
        </div>
        <div className="page-shell pb-14">
          <ReviewSection
            subject="course"
            subjectId={course.id}
            title="امتیاز و نظرات دانشجویان"
            rating={course.rating}
            count={course.reviewsCount ?? 0}
            reviews={course.reviews}
            distribution={course.distribution}
          />
        </div>
        {related.length > 0 && (
          <section className="border-t hairline bg-white py-14">
            <div className="page-shell">
              <h2 className="text-2xl font-black">دوره‌های مرتبط</h2>
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
