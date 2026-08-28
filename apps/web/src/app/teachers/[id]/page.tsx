import { localized, isDefaultLocale } from '@/lib/i18n';
import { notFound } from 'next/navigation';
import { BadgeCheck, Play, Star } from 'lucide-react';
import { Header, Footer } from '@/components/layout/site';
import { publicApi, type PublicTeacher } from '@/lib/api';
import { requestLocale } from '@/lib/server-locale';
import { TeacherBookingCard } from '@/features/teacher/components/teacher-booking-card';
export const dynamic = 'force-dynamic';
export default async function Profile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params,
    locale = await requestLocale(),
    fa = isDefaultLocale(locale);
  let t: PublicTeacher;
  try {
    t = await publicApi<PublicTeacher>(`/teachers/${id}`, { cache: 'no-store' });
  } catch {
    notFound();
  }
  return (
    <>
      <Header />
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
          <div>
            <div className="relative aspect-video rounded-4xl bg-gradient-to-br from-navy via-blue to-purple">
              <span className="absolute inset-0 m-auto grid h-20 w-20 place-items-center rounded-full bg-white/90 text-purple shadow-brand">
                <Play />
              </span>
            </div>
            <div className="mt-8 flex justify-between gap-5">
              <div>
                <h1 className="flex gap-3 text-4xl font-black">
                  {localized({ fa: t.nameFa, en: t.nameEn }, locale)}
                  <BadgeCheck className="text-blue" />
                </h1>
                <p className="mt-2 text-muted">{localized({ fa: t.nameEn, en: t.nameFa }, locale)}</p>
              </div>
              <p className="flex gap-2">
                <Star fill="#f5a623" className="text-[#f5a623]" />
                {t.rating} ({t.reviewsCount})
              </p>
            </div>
            <p className="mt-8 text-lg leading-9 text-muted">
              {localized({ fa: t.bioFa, en: t.bioEn ?? t.bioFa }, locale)}
            </p>
            <div className="mt-8 flex flex-wrap gap-2">
              {t.specialties.map((x) => (
                <span key={x} className="rounded-full border hairline px-4 py-2 latin">
                  {x}
                </span>
              ))}
            </div>
          </div>
          <aside>
            <TeacherBookingCard teacherId={t.id} trialPrice={t.trialPrice} />
          </aside>
        </div>
      </main>
      <Footer />
    </>
  );
}
