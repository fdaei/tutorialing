import { localized } from '@/lib/i18n';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BadgeCheck, Languages, Play, Star, UserRound, Users } from 'lucide-react';
import { Header, Footer } from '@/components/layout/site';
import { ApiError, publicApi } from '@/shared/services/api';
import type { PublicTeacher } from '@/features/teacher';
import { requestLocale } from '@/lib/server-locale';
import { TeacherBookingCard } from '@/features/teacher/components/teacher-booking-card';
import { ReviewSection } from '@/components/reviews/review-section';
import { publicPageMetadata } from '@/lib/public-metadata';
import { TeacherIntroVideoDialog } from '@/features/teacher/components/teacher-intro-video-dialog';
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  try {
    const teacher = await publicApi<PublicTeacher>(`/teachers/${id}`, { cache: 'no-store' });
    return publicPageMetadata(
      `/teachers/${id}`,
      { fa: `مدرس زبان ${teacher.nameFa}`, en: `${teacher.nameEn} — language teacher` },
      {
        fa: teacher.bioFa || `پروفایل، تخصص‌ها، امتیاز و زمان‌های تدریس ${teacher.nameFa}`,
        en: teacher.bioEn || `Profile, specialties, ratings, and availability for ${teacher.nameEn}.`,
      },
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return {};
    throw error;
  }
}

export default async function Profile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params,
    locale = await requestLocale();
  let t: PublicTeacher;
  try {
    t = await publicApi<PublicTeacher>(`/teachers/${id}`, { cache: 'no-store' });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  const english = locale === 'en';
  const copy = (fa: string, en: string) => english ? en : fa;
  return (
    <>
      <Header />
      <main className="page-shell py-8 md:py-12">
        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          <div>
            <div className="teacher-profile-hero">
              <div className="relative grid size-28 shrink-0 place-items-center rounded-3xl bg-white/12 text-white">
                <UserRound size={58} />
              </div>
              <div className="relative min-w-0 flex-1">
                <p className="mb-2 text-sm font-bold text-white/65">{copy('مدرس تأییدشده لینگواسپیک', 'Verified LingoSpeak teacher')}</p>
                <h1 className="flex flex-wrap items-center gap-3 text-3xl font-black text-white md:text-4xl">
                  {localized({ fa: t.nameFa, en: t.nameEn }, locale)} <BadgeCheck className="text-sky-300" />
                </h1>
                <p className="latin mt-1 w-fit text-sm text-white/60">
                  {localized({ fa: t.nameEn, en: t.nameFa }, locale)}
                </p>
                <div className="mt-5 flex flex-wrap gap-4 text-sm text-white/80">
                  <span className="flex items-center gap-2">
                    <Star className="fill-amber-400 text-amber-400" size={18} />
                    <b className="latin">{t.rating || '—'}</b> ({t.reviewsCount.toLocaleString(english ? 'en-US' : 'fa-IR')} {copy('نظر', 'reviews')})
                  </span>
                  <span className="flex items-center gap-2">
                    <Users size={18} />
                    {(t.studentsCount ?? 0).toLocaleString(english ? 'en-US' : 'fa-IR')} {copy('زبان‌آموز', 'learners')}
                  </span>
                  <span className="flex items-center gap-2">
                    <Languages size={18} />
                    {t.languageLinks
                      ?.map((x) => localized({ fa: x.language.nameFa, en: x.language.nameEn }, locale))
                      .join(english ? ', ' : '، ')}
                  </span>
                </div>
              </div>
              {t.introVideoKey && (
                <TeacherIntroVideoDialog
                  teacherSlug={t.slug}
                  teacherName={localized({ fa: t.nameFa, en: t.nameEn }, locale)}
                />
              )}
            </div>
            {!t.introVideoKey && (
              <div className="mt-4 flex items-center gap-3 rounded-2xl border hairline bg-white p-4 text-sm text-muted">
                <span className="grid size-10 place-items-center rounded-xl bg-lavender text-purple">
                  <Play size={18} />
                </span>
                {copy('ویدیوی معرفی این مدرس هنوز منتشر نشده است.', 'This teacher has not published an introduction video yet.')}
              </div>
            )}
            <div className="mt-7 rounded-3xl border hairline bg-white p-6 md:p-8">
              <h2 className="text-xl font-black">{copy('درباره مدرس', 'About the teacher')}</h2>
              <p className="mt-4 text-base leading-9 text-muted">
                {localized({ fa: t.bioFa, en: t.bioEn ?? t.bioFa }, locale)}
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {t.specialties.map((x) => (
                  <span key={x} className="latin rounded-full bg-lavender px-4 py-2 text-sm font-bold text-purple">
                    {x}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <TeacherBookingCard teacherId={t.id} trialPrice={t.approvedTrialPrice} />
          </aside>
        </div>
        <ReviewSection
          subject="teacher"
          subjectId={t.id}
          title={copy('نظر دانشجویان درباره این مدرس', 'Learner reviews of this teacher')}
          rating={t.rating}
          count={t.reviewsCount}
          reviews={t.reviews ?? []}
          distribution={t.distribution}
        />
      </main>
      <Footer />
    </>
  );
}
