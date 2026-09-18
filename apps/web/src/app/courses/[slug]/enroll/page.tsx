import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, CalendarDays } from 'lucide-react';
import { Header, Footer } from '@/components/layout/site';
import { publicApi } from '@/shared/services/api';
import { requestLocale } from '@/lib/server-locale';
import { localePath } from '@/lib/i18n';
import type { Course } from '@/lib/marketplace-data';
import type { PublicTeacher } from '@/features/teacher/types/public-teacher';
import { CourseEnrollmentCta } from '@/features/courses/components/course-enrollment-cta';
import { resolveHeaderConfig } from '@/lib/header-config';

type CourseData = Course & { id: string; package?: { credits: number } | null };

export const dynamic = 'force-dynamic';

export default async function CourseEnrollmentPage({ params }: { params: Promise<{ slug: string }> }) {
  const [{ slug }, locale, headerConfig] = await Promise.all([params, requestLocale(), resolveHeaderConfig()]);
  const course = await publicApi<CourseData>(`/courses/${slug}`).catch(() => null);
  if (!course || course.format !== 'LIVE_ONLINE' || !course.id || !course.teacherId) notFound();
  const teacher = await publicApi<PublicTeacher>(`/teachers/${course.teacherId}`).catch(() => null);
  const english = locale === 'en';
  const title = english ? course.titleEn ?? course.title : course.titleFa ?? course.title;
  const teacherName = teacher ? (english ? teacher.nameEn : teacher.nameFa) : course.teacherName;
  const sessions = course.package?.credits ?? course.lessonsCount ?? 1;

  return (
    <>
      <Header config={headerConfig} />
      <main className="page-shell py-8 md:py-12">
        <Link href={localePath(`/courses/${slug}`, locale)} className="mb-8 inline-flex items-center gap-2 text-sm font-bold text-muted hover:text-purple">
          <ArrowRight size={17} className={english ? 'rotate-180' : undefined} />
          {english ? 'Back to course' : 'بازگشت به صفحه دوره'}
        </Link>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section>
            <div className="mb-7 flex items-center gap-4">
              <div className="relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-lavender text-purple">
                {teacher?.avatarUrl || course.teacherId === 'teacher-shahriar' || course.teacherId === 'teacher-arezoo' ? <Image src={teacher?.avatarUrl ?? (course.teacherId === 'teacher-shahriar' ? '/images/teachers/shahriar-shahfar.png' : '/images/teachers/arezoo-ahmadi.png')} alt={teacherName ?? ''} fill sizes="64px" className="object-cover" /> : <CalendarDays size={28} />}
              </div>
              <div>
                <p className="text-sm font-black text-purple">{english ? 'Private class with' : 'کلاس خصوصی با'}</p>
                <h1 className="mt-1 text-2xl font-black md:text-3xl">{teacherName}</h1>
              </div>
            </div>
            <div className="surface-card p-6 md:p-8">
              <p className="text-sm font-black text-purple">{english ? 'Choose your class times' : 'زمان کلاس را انتخاب کنید'}</p>
              <h2 className="mt-2 text-2xl font-black">{title}</h2>
              <p className="mt-3 text-sm leading-7 text-muted">
                {english ? `Select ${sessions} available time${sessions === 1 ? '' : 's'} below. Times are shown in your local timezone.` : `${sessions.toLocaleString('fa-IR')} زمان آزاد را انتخاب کنید. ساعت‌ها با منطقه زمانی شما نمایش داده می‌شوند.`}
              </p>
              <CourseEnrollmentCta slug={course.slug} courseId={course.id} price={course.price} format={course.format} teacherId={course.teacherId} sessionsCount={sessions} />
            </div>
          </section>
          <aside className="surface-card h-fit p-6 lg:sticky lg:top-24">
            <p className="text-xs font-black text-purple">{english ? 'How the time is displayed' : 'نحوه نمایش زمان کلاس'}</p>
            <div className="mt-4 grid gap-3 text-sm leading-7 text-muted">
              <p><strong className="text-ink">{english ? 'Date:' : 'تاریخ:'}</strong> {english ? 'Saturday, September 20' : 'شنبه ۲۹ شهریور'}</p>
              <p><strong className="text-ink">{english ? 'Time:' : 'ساعت:'}</strong> ۱۲:۰۰ تا ۱۳:۰۰</p>
              <p><strong className="text-ink">{english ? 'Timezone:' : 'منطقه زمانی:'}</strong> Asia/Tehran</p>
              <p>{english ? 'You will choose every session before uploading the payment receipt.' : 'همه جلسه‌ها را قبل از بارگذاری فیش انتخاب می‌کنید.'}</p>
            </div>
          </aside>
        </div>
      </main>
      <Footer />
    </>
  );
}
