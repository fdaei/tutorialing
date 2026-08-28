'use client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Headphones,
  LifeBuoy,
  MessageCircle,
  Target,
} from 'lucide-react';
import { api } from '@/shared/services/api';
import { PanelShell, studentNav } from '@/features/panel';
import { useTranslations } from '@/components/shared/locale-provider';
import { formatDate, localePath, localized } from '@/lib/i18n';
type Me = { name?: string };
type Booking = {
  startsAt: string;
  status: string;
  meetingUrl?: string;
  teacher?: { nameFa?: string; nameEn?: string };
};
type Attempt = { status: string; overallBand?: number };
type PlacementResult = { score: number; level: string; completedAt: string };
export default function Dashboard() {
  const { locale, t } = useTranslations(),
    p = (href: string) => localePath(href, locale),
    me = useQuery({ queryKey: ['me'], queryFn: () => api<Me>('/users/me') }),
    bookings = useQuery({ queryKey: ['bookings'], queryFn: () => api<Booking[]>('/bookings/me') }),
    attempts = useQuery({ queryKey: ['attempt-history'], queryFn: () => api<Attempt[]>('/tests/attempts/history') }),
    placement = useQuery({ queryKey: ['placement-history'], queryFn: () => api<PlacementResult[]>('/placement/history') });
  const next = bookings.data?.find((b) => new Date(b.startsAt) > new Date() && b.status === 'CONFIRMED'),
    last = attempts.data?.find((a) => a.status === 'APPROVED'),
    latestPlacement = placement.data?.[0],
    assessmentDone = Boolean(last || latestPlacement),
    hasClass = Boolean(next),
    teacherName = localized({ fa: next?.teacher?.nameFa, en: next?.teacher?.nameEn }, locale);
  const journey = [
    { icon: CheckCircle2, title: t('createAccount'), status: t('completed'), done: true, href: '/dashboard/plan' },
    {
      icon: Target,
      title: t('assessLevel'),
      status: t(assessmentDone ? 'completed' : 'yourNextStep'),
      done: assessmentDone,
      href: '/placement',
    },
    {
      icon: BookOpen,
      title: t('chooseATeacher'),
      status: t(bookings.data?.length ? 'active' : 'afterAssessment'),
      done: Boolean(bookings.data?.length),
      href: '/matching',
    },
    {
      icon: Headphones,
      title: t('startClasses'),
      status: t(hasClass ? 'booked' : 'waitingForBooking'),
      done: hasClass,
      href: '/matching',
    },
  ];
  return (
    <PanelShell title={t('studentPanel')} items={studentNav}>
      <section className="soft-gradient panel-card relative overflow-hidden p-7 md:p-10">
        <div className="relative grid items-center gap-8 lg:grid-cols-[1fr_320px]">
          <div>
            <span className="inline-flex rounded-full bg-white/75 px-4 py-2 text-xs font-bold text-purple">
              {t('dashboardMotto')}
            </span>
            <h1 className="mt-7 text-5xl font-black leading-tight md:text-6xl">
              {t('dashboardGreeting')} {me.data?.name ?? t('dashboardGuest')}
              <br />
              <span className="brand-text">{t('dashboardStayInFlow')}</span>
            </h1>
            <p className="mt-5 max-w-xl leading-8 text-muted">{t('dashboardIntro')}</p>
            <Link
              href={p(assessmentDone ? '/dashboard/plan' : '/placement')}
              className="brand-gradient brand-glow mt-7 inline-flex items-center gap-3 rounded-xl px-7 py-4 font-black text-white"
            >
              {t(assessmentDone ? 'continueLearningPlan' : 'startPlacement')}
              <ArrowRight className="rtl:rotate-180" size={19} />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Stat label={t('tests')} value={(attempts.data?.length ?? 0) + (placement.data?.length ?? 0)} />
            <Stat label={t('classes')} value={bookings.data?.length ?? 0} />
            {last && (
              <div className="panel-card col-span-2 p-5">
                <small className="block text-muted">{t('latestApprovedBand')}</small>
                <strong className="latin mt-2 block text-3xl text-purple">{last.overallBand}</strong>
              </div>
            )}
            {!last && latestPlacement && (
              <div className="panel-card col-span-2 p-5">
                <small className="block text-muted">آخرین نتیجه تعیین سطح</small>
                <strong className="latin mt-2 block text-3xl text-purple">{latestPlacement.level} · {latestPlacement.score}%</strong>
              </div>
            )}
          </div>
        </div>
      </section>
      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <Link
          href={p(hasClass ? '/dashboard/classes' : '/matching')}
          className="panel-card lift flex items-center gap-4 p-6"
        >
          <span className="grid size-14 place-items-center rounded-full bg-lavender text-purple">
            <CalendarDays />
          </span>
          <span className="flex-1">
            <small className="font-bold text-purple">{t(hasClass ? 'nextClass' : 'nextStep')}</small>
            <strong className="mt-1 block text-xl">
              {hasClass ? `${t('classWith')} ${teacherName || t('teacherFallback')}` : t('chooseTeacher')}
            </strong>
            <small className="mt-1 block text-muted">
              {hasClass && next ? formatDate(next.startsAt, locale) : t('smartRecommendations')}
            </small>
          </span>
          <ArrowRight className="rtl:rotate-180" />
        </Link>
        <Link
          href={p(assessmentDone ? '/dashboard/tests' : '/placement')}
          className="panel-card lift flex items-center gap-4 p-6"
        >
          <span
            className={`grid size-14 place-items-center rounded-full ${assessmentDone ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-500'}`}
          >
            {assessmentDone ? <CheckCircle2 /> : <AlertTriangle />}
          </span>
          <span className="flex-1">
            <small className="font-bold text-orange-500">{t('needsAttention')}</small>
            <strong className="mt-1 block text-xl">
              {t(assessmentDone ? 'viewPlacementResult' : 'completePlacement')}
            </strong>
            <small className="mt-1 block text-muted">{t(assessmentDone ? 'resultReady' : 'assessToBegin')}</small>
          </span>
          <ArrowRight className="rtl:rotate-180" />
        </Link>
      </section>
      <section className="mt-6 grid gap-5 xl:grid-cols-[1fr_330px]">
        <article className="panel-card p-6 md:p-8">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black">{t('learningJourney')}</h2>
            <Link href={p('/dashboard/plan')} className="text-sm font-bold text-blue">
              {t('viewAll')}
            </Link>
          </div>
          <div className="mt-6 divide-y hairline">
            {journey.map(({ icon: Icon, title, status, done, href }) => {
              return (
                <div key={String(title)} className="flex items-center gap-4 py-5">
                  <span
                    className={`grid size-11 place-items-center rounded-xl ${done ? 'bg-[#eef2ff] text-blue' : 'bg-[#f4f5f8] text-muted'}`}
                  >
                    <Icon size={21} />
                  </span>
                  <p className="flex-1">
                    <strong>{title}</strong>
                    <small className="mt-1 block text-muted">{status}</small>
                  </p>
                  {done ? (
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-600">
                      {t('done')}
                    </span>
                  ) : (
                    <Link
                      href={p(href)}
                      className="rounded-xl border border-blue px-4 py-2 text-sm font-bold text-blue"
                    >
                      {t('start')}
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </article>
        <aside className="relative overflow-hidden rounded-[24px] bg-[#111b4a] p-7 text-white shadow-brand">
          <span className="grid size-14 place-items-center rounded-full bg-purple/25 text-violet">
            <LifeBuoy />
          </span>
          <h2 className="mt-10 text-3xl font-black">{t('needHelp')}</h2>
          <p className="mt-4 text-sm leading-7 text-white/60">{t('supportIntro')}</p>
          <Link
            href={p('/dashboard/tickets')}
            className="brand-gradient mt-8 flex items-center justify-center gap-3 rounded-xl px-5 py-4 font-black"
          >
            <MessageCircle size={19} />
            {t('createTicket')}
          </Link>
        </aside>
      </section>
    </PanelShell>
  );
}
function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="panel-card p-5">
      <small className="block text-muted">{label}</small>
      <strong className="latin mt-2 block text-3xl">{value}</strong>
    </div>
  );
}
