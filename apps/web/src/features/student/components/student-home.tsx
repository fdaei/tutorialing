'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Circle,
  GraduationCap,
  LifeBuoy,
  PlayCircle,
  Target,
  Video,
} from 'lucide-react';
import { api } from '@/shared/services/api';
import { useTranslations } from '@/components/shared/locale-provider';
import { formatDate, localePath, localized, type Locale } from '@/lib/i18n';
import { formatNumber } from '@/lib/money';
import { isLinkEnabled } from '@/config';
import type { LearningEnrollment } from '@/features/courses/course-types';
import { useNotifications } from '@/features/panel/hooks/use-notifications';
import { ButtonLink, Card, CardHeader, EmptyState, Skeleton, Stat, StatusBadge, cn } from '@/shared/components/ui';

type Me = { name?: string };
type Booking = {
  id?: string;
  startsAt: string;
  endsAt?: string;
  status: string;
  meetingUrl?: string;
  teacher?: { nameFa?: string; nameEn?: string };
};
type Attempt = { status: string; overallBand?: number };
type PlacementResult = {
  id?: string;
  score: number;
  level: string;
  completedAt: string;
  test?: { titleFa?: string; titleEn?: string; language?: string | { nameFa?: string; nameEn?: string } };
};

const CEFR = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
const copy = (locale: Locale, fa: string, en: string) => (locale === 'en' ? en : fa);

export function StudentHome() {
  const { locale } = useTranslations();
  const english = locale === 'en';
  const p = (href: string) => localePath(href, locale);
  const Forward = english ? ArrowRight : ArrowLeft;
  const me = useQuery({ queryKey: ['me'], queryFn: () => api<Me>('/users/me') });
  const bookings = useQuery({ queryKey: ['bookings'], queryFn: () => api<Booking[]>('/bookings/me') });
  const attempts = useQuery({ queryKey: ['attempt-history'], queryFn: () => api<Attempt[]>('/tests/attempts/history') });
  const placement = useQuery({ queryKey: ['placement-history'], queryFn: () => api<PlacementResult[]>('/placement/history') });
  const courses = useQuery({ queryKey: ['my-courses'], queryFn: () => api<LearningEnrollment[]>('/courses/me/learning') });
  const notifications = useNotifications();

  const now = Date.now();
  const upcoming = (bookings.data ?? [])
    .filter((booking) => new Date(booking.startsAt).getTime() > now - 60 * 60 * 1000 && ['CONFIRMED', 'PENDING_PAYMENT', 'PENDING'].includes(booking.status))
    .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
  const nextClass = upcoming.find((booking) => booking.status === 'CONFIRMED');
  const latestPlacement = placement.data?.[0];
  const approvedAttempt = attempts.data?.find((attempt) => attempt.status === 'APPROVED');
  const activeCourses = (courses.data ?? []).filter((item) => !item.completedAt);
  const resume = [...activeCourses].sort((a, b) => b.progressPercent - a.progressPercent)[0];
  const completedLessons = (courses.data ?? []).reduce((sum, item) => sum + (item.completedLessons ?? 0), 0);
  const level = latestPlacement?.level;
  const loadingCore = placement.isLoading || courses.isLoading || bookings.isLoading;
  const firstName = me.data?.name?.trim().split(/\s+/)[0];

  const nextAction = (() => {
    if (nextClass && new Date(nextClass.startsAt).getTime() - now < 24 * 60 * 60 * 1000) {
      const teacher = localized({ fa: nextClass.teacher?.nameFa, en: nextClass.teacher?.nameEn }, locale);
      const joinable = Boolean(nextClass.meetingUrl) && new Date(nextClass.startsAt).getTime() - now < 30 * 60 * 1000;
      return {
        icon: <Video size={22} />,
        eyebrow: copy(locale, 'کلاس بعدی شما', 'Your next class'),
        title: teacher ? copy(locale, `کلاس با ${teacher}`, `Class with ${teacher}`) : copy(locale, 'کلاس زنده', 'Live class'),
        body: formatDate(nextClass.startsAt, locale),
        cta: joinable ? copy(locale, 'ورود به کلاس', 'Join class') : copy(locale, 'جزئیات کلاس', 'Class details'),
        href: joinable && nextClass.meetingUrl ? nextClass.meetingUrl : p('/dashboard/classes'),
        external: joinable,
      };
    }
    if (!latestPlacement && !approvedAttempt)
      return {
        icon: <Target size={22} />,
        eyebrow: copy(locale, 'قدم اول', 'Start here'),
        title: copy(locale, 'سطح زبان خود را در حدود ۱۵ دقیقه مشخص کنید', 'Find your level in about 15 minutes'),
        body: copy(locale, 'نتیجه تعیین سطح، دوره و مسیر مناسب شما را مشخص می‌کند.', 'Your placement result decides which course and route fit you.'),
        cta: copy(locale, 'شروع آزمون تعیین سطح', 'Start placement test'),
        href: p('/placement'),
      };
    if (resume)
      return {
        icon: <PlayCircle size={22} />,
        eyebrow: copy(locale, 'ادامه یادگیری', 'Continue learning'),
        title: localized({ fa: resume.course.titleFa, en: resume.course.titleEn }, locale),
        body: resume.lastLesson
          ? copy(locale, `آخرین درس: ${resume.lastLesson.titleFa}`, `Last lesson: ${resume.lastLesson.titleEn}`)
          : copy(locale, 'از اولین درس شروع کنید.', 'Start from the first lesson.'),
        progress: resume.progressPercent,
        cta: resume.progressPercent ? copy(locale, 'ادامه درس', 'Resume lesson') : copy(locale, 'شروع دوره', 'Start course'),
        href: p(`/courses/${resume.course.slug}/learn`),
      };
    return {
      icon: <GraduationCap size={22} />,
      eyebrow: level ? copy(locale, `پیشنهاد برای سطح ${level}`, `Recommended for ${level}`) : copy(locale, 'قدم بعدی', 'Next step'),
      title: copy(locale, 'دوره متناسب با سطح خود را انتخاب کنید', 'Choose a course that matches your level'),
      body: copy(locale, 'دوره‌ها بر اساس نتیجه تعیین سطح شما فیلتر شده‌اند.', 'Courses are filtered to your placement result.'),
      cta: copy(locale, 'مشاهده دوره‌های پیشنهادی', 'See recommended courses'),
      href: p(level ? `/courses?level=${encodeURIComponent(level)}` : '/courses'),
    };
  })();

  const journey = [
    { title: copy(locale, 'تعیین سطح', 'Placement test'), done: Boolean(latestPlacement || approvedAttempt), href: '/placement' },
    { title: copy(locale, 'ثبت‌نام در دوره', 'Enroll in a course'), done: Boolean(courses.data?.length), href: '/courses' },
    { title: copy(locale, 'تکمیل اولین درس', 'Complete a first lesson'), done: completedLessons > 0, href: resume ? `/courses/${resume.course.slug}/learn` : '/courses' },
    { title: copy(locale, 'رزرو کلاس زنده', 'Book a live class'), done: Boolean(bookings.data?.length), href: '/matching' },
  ].filter((step) => step.done || isLinkEnabled(step.href));
  const journeyDone = journey.filter((step) => step.done).length;

  return (
    <div className="grid gap-5 lg:gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{new Intl.DateTimeFormat(english ? 'en-US' : 'fa-IR-u-ca-persian', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}</p>
          <h1 className="mt-1 text-2xl font-black text-ink md:text-h1">
            {firstName ? copy(locale, `سلام ${firstName}، خوش برگشتی`, `Welcome back, ${firstName}`) : copy(locale, 'خوش آمدید', 'Welcome')}
          </h1>
        </div>
        {journey.length > 0 && journeyDone < journey.length && (
          <p className="text-sm text-muted">
            {copy(locale, 'پیشرفت مسیر شروع:', 'Getting started:')}{' '}
            <b className="text-ink">
              {formatNumber(journeyDone, locale)}/{formatNumber(journey.length, locale)}
            </b>
          </p>
        )}
      </header>

      {loadingCore ? (
        <Skeleton className="h-44 rounded-2xl" />
      ) : (
        <section className="relative overflow-hidden rounded-2xl bg-ink p-5 text-white shadow-soft sm:p-7">
          <span aria-hidden="true" className="pointer-events-none absolute -end-16 -top-20 size-64 rounded-full bg-accent/30 blur-3xl" />
          <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <span className="hidden size-12 shrink-0 place-items-center rounded-2xl bg-white/10 text-violet sm:grid">{nextAction.icon}</span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-violet">{nextAction.eyebrow}</p>
                <h2 className="mt-1 text-xl font-black leading-9 sm:text-2xl">{nextAction.title}</h2>
                <p className="mt-1 text-sm leading-7 text-white/70">{nextAction.body}</p>
                {'progress' in nextAction && typeof nextAction.progress === 'number' && (
                  <div className="mt-3 flex max-w-sm items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/15">
                      <div className="h-full rounded-full bg-violet" style={{ width: `${nextAction.progress}%` }} />
                    </div>
                    <span className="latin text-xs font-bold">{nextAction.progress}%</span>
                  </div>
                )}
              </div>
            </div>
            {'external' in nextAction && nextAction.external ? (
              <a href={nextAction.href} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-5 font-bold text-ink hover:bg-lavender">
                {nextAction.cta} <Forward size={18} />
              </a>
            ) : (
              <Link href={nextAction.href} className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 font-bold text-ink hover:bg-lavender">
                {nextAction.cta} <Forward size={18} />
              </Link>
            )}
          </div>
        </section>
      )}

      <section aria-label={copy(locale, 'خلاصه', 'Summary')} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={<Target size={19} />} tone="accent" label={copy(locale, 'سطح فعلی', 'Current level')} value={level ?? (approvedAttempt?.overallBand != null ? `Band ${approvedAttempt.overallBand}` : '—')} />
        <Stat icon={<BookOpen size={19} />} label={copy(locale, 'دوره‌های در جریان', 'Courses in progress')} value={formatNumber(activeCourses.length, locale)} />
        <Stat icon={<CheckCircle2 size={19} />} tone="success" label={copy(locale, 'درس‌های تکمیل‌شده', 'Lessons completed')} value={formatNumber(completedLessons, locale)} />
        <Stat icon={<CalendarDays size={19} />} tone="warning" label={copy(locale, 'کلاس‌های پیش رو', 'Upcoming classes')} value={formatNumber(upcoming.length, locale)} />
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-6">
        <div className="grid content-start gap-5 lg:gap-6">
          <Card>
            <CardHeader
              icon={<BookOpen size={19} />}
              title={copy(locale, 'دوره‌های من', 'My courses')}
              action={
                courses.data?.length ? (
                  <Link href={p('/dashboard/courses')} className="text-sm font-bold text-primary">
                    {copy(locale, 'همه', 'View all')}
                  </Link>
                ) : undefined
              }
            />
            {courses.isLoading ? (
              <div className="grid gap-3">
                <Skeleton className="h-20" />
                <Skeleton className="h-20" />
              </div>
            ) : courses.data?.length ? (
              <ul className="grid gap-2">
                {courses.data.slice(0, 3).map((item) => (
                  <li key={item.id}>
                    <Link href={p(`/courses/${item.course.slug}/learn`)} className="flex items-center gap-4 rounded-xl border border-line p-3 transition hover:border-primary/40 hover:bg-primary-soft/40">
                      <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-lavender text-sm font-black text-purple">
                        {item.course.image ? <img src={item.course.image} alt="" className="size-full object-cover" /> : item.course.level}
                      </span>
                      <span className="min-w-0 flex-1">
                        <strong className="block truncate text-sm">{localized({ fa: item.course.titleFa, en: item.course.titleEn }, locale)}</strong>
                        <span className="mt-2 flex items-center gap-3">
                          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-canvas">
                            <span className={cn('block h-full rounded-full', item.completedAt ? 'bg-success' : 'bg-primary')} style={{ width: `${item.progressPercent}%` }} />
                          </span>
                          <span className="latin text-xs font-bold text-muted">{item.progressPercent}%</span>
                        </span>
                      </span>
                      <PlayCircle size={20} className="shrink-0 text-primary" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                compact
                icon={<BookOpen size={20} />}
                title={copy(locale, 'هنوز در دوره‌ای ثبت‌نام نکرده‌اید', 'No courses yet')}
                description={copy(locale, 'دوره‌ای متناسب با سطح خود انتخاب کنید و از همین امروز شروع کنید.', 'Pick a course that matches your level and start today.')}
                action={<ButtonLink href={p(level ? `/courses?level=${level}` : '/courses')} size="sm">{copy(locale, 'مشاهده دوره‌ها', 'Browse courses')}</ButtonLink>}
              />
            )}
          </Card>

          <Card>
            <CardHeader
              icon={<CalendarDays size={19} />}
              title={copy(locale, 'جلسات پیش رو', 'Upcoming sessions')}
              action={
                <Link href={p('/dashboard/classes')} className="text-sm font-bold text-primary">
                  {copy(locale, 'تقویم', 'Calendar')}
                </Link>
              }
            />
            {bookings.isLoading ? (
              <Skeleton className="h-20" />
            ) : upcoming.length ? (
              <ul className="divide-y divide-line">
                {upcoming.slice(0, 3).map((booking, index) => {
                  const date = new Date(booking.startsAt);
                  return (
                    <li key={booking.id ?? index} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                      <span className="grid w-14 shrink-0 place-items-center rounded-xl bg-canvas py-1.5 text-center">
                        <span className="text-[11px] font-bold text-muted">{new Intl.DateTimeFormat(english ? 'en-US' : 'fa-IR-u-ca-persian', { month: 'short' }).format(date)}</span>
                        <span className="text-lg font-black leading-6 text-ink">{new Intl.DateTimeFormat(english ? 'en-US' : 'fa-IR-u-ca-persian', { day: 'numeric' }).format(date)}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <strong className="block truncate text-sm">
                          {localized({ fa: booking.teacher?.nameFa, en: booking.teacher?.nameEn }, locale) || copy(locale, 'کلاس زنده', 'Live class')}
                        </strong>
                        <span className="text-xs text-muted">{new Intl.DateTimeFormat(english ? 'en-US' : 'fa-IR', { hour: '2-digit', minute: '2-digit' }).format(date)}</span>
                      </span>
                      <StatusBadge value={booking.status} />
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="rounded-xl bg-canvas p-4 text-sm leading-7 text-muted">
                {copy(locale, 'جلسه‌ای برای روزهای آینده ندارید.', 'You have no sessions scheduled.')}
                {isLinkEnabled('/matching') && (
                  <>
                    {' '}
                    <Link href={p('/matching')} className="font-bold text-primary">
                      {copy(locale, 'پیدا کردن مدرس', 'Find a teacher')}
                    </Link>
                  </>
                )}
              </p>
            )}
          </Card>
        </div>

        <div className="grid content-start gap-5 lg:gap-6">
          <Card>
            <CardHeader icon={<Target size={19} />} title={copy(locale, 'سطح زبان', 'Language level')} />
            {placement.isLoading ? (
              <Skeleton className="h-24" />
            ) : latestPlacement ? (
              <>
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="latin text-4xl font-black text-ink">{latestPlacement.level}</p>
                    <p className="mt-1 text-xs text-muted">
                      {copy(locale, 'آخرین تعیین سطح', 'Last placement')} · {new Intl.DateTimeFormat(english ? 'en-US' : 'fa-IR-u-ca-persian', { dateStyle: 'medium' }).format(new Date(latestPlacement.completedAt))}
                    </p>
                  </div>
                  <span className="latin rounded-full bg-lavender px-3 py-1 text-sm font-bold text-purple">{Math.round(latestPlacement.score)}%</span>
                </div>
                <ol className="mt-4 grid grid-cols-6 gap-1" aria-label={copy(locale, 'مقیاس CEFR', 'CEFR scale')}>
                  {CEFR.map((step) => {
                    const reached = CEFR.indexOf(step) <= CEFR.indexOf(latestPlacement.level as (typeof CEFR)[number]);
                    return (
                      <li key={step} className="grid gap-1 text-center">
                        <span className={cn('h-2 rounded-full', reached ? 'bg-primary' : 'bg-canvas')} />
                        <span className={cn('latin text-[11px] font-bold', step === latestPlacement.level ? 'text-primary' : 'text-subtle')}>{step}</span>
                      </li>
                    );
                  })}
                </ol>
                <div className="mt-4 flex flex-wrap gap-2">
                  <ButtonLink href={p(`/courses?level=${latestPlacement.level}`)} size="sm">
                    {copy(locale, 'دوره‌های این سطح', 'Courses for this level')}
                  </ButtonLink>
                  <ButtonLink href={p('/placement')} size="sm" variant="ghost">
                    {copy(locale, 'آزمون مجدد', 'Retake')}
                  </ButtonLink>
                </div>
              </>
            ) : (
              <div className="grid gap-3">
                <p className="text-sm leading-7 text-muted">{copy(locale, 'هنوز سطح شما مشخص نشده است.', 'Your level has not been assessed yet.')}</p>
                <ButtonLink href={p('/placement')} size="sm" className="justify-self-start">
                  {copy(locale, 'شروع تعیین سطح', 'Take placement test')}
                </ButtonLink>
              </div>
            )}
          </Card>

          {journeyDone < journey.length && (
            <Card>
              <CardHeader title={copy(locale, 'مسیر شروع', 'Getting started')} description={copy(locale, `${formatNumber(journeyDone, locale)} از ${formatNumber(journey.length, locale)} مرحله`, `${journeyDone} of ${journey.length} steps`)} />
              <ol className="grid gap-1">
                {journey.map((step) => (
                  <li key={step.title}>
                    <Link href={p(step.href)} className={cn('flex min-h-11 items-center gap-3 rounded-xl px-2 text-sm', step.done ? 'text-muted' : 'font-bold text-ink hover:bg-canvas')}>
                      {step.done ? <CheckCircle2 size={19} className="text-success" aria-hidden="true" /> : <Circle size={19} className="text-subtle" aria-hidden="true" />}
                      <span className={cn('flex-1', step.done && 'line-through decoration-line')}>{step.title}</span>
                      <span className="sr-only">{step.done ? copy(locale, 'انجام شد', 'done') : copy(locale, 'انجام نشده', 'to do')}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            </Card>
          )}

          <Card>
            <CardHeader
              icon={<Bell size={19} />}
              title={copy(locale, 'اعلان‌ها', 'Notifications')}
              action={
                <Link href={p('/dashboard/notifications')} className="text-sm font-bold text-primary">
                  {copy(locale, 'همه', 'View all')}
                </Link>
              }
            />
            {notifications.isLoading ? (
              <Skeleton className="h-16" />
            ) : notifications.data?.length ? (
              <ul className="grid gap-1">
                {notifications.data.slice(0, 4).map((item) => (
                  <li key={item.id} className="flex items-start gap-2.5 rounded-xl px-1 py-2">
                    <span aria-hidden="true" className={cn('mt-2 size-2 shrink-0 rounded-full', item.readAt ? 'bg-transparent' : 'bg-primary')} />
                    <span className="min-w-0">
                      <strong className={cn('block truncate text-sm', item.readAt ? 'font-medium text-muted' : 'text-ink')}>{localized({ fa: item.titleFa, en: item.titleEn }, locale)}</strong>
                      <span className="text-xs text-subtle">{new Intl.DateTimeFormat(english ? 'en-US' : 'fa-IR-u-ca-persian', { dateStyle: 'medium' }).format(new Date(item.createdAt))}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">{copy(locale, 'اعلان تازه‌ای ندارید.', 'You are all caught up.')}</p>
            )}
          </Card>

          <Link href={p('/dashboard/tickets')} className="panel-card flex items-center gap-3 p-4 transition hover:border-primary/40">
            <span className="grid size-10 place-items-center rounded-xl bg-canvas text-muted">
              <LifeBuoy size={19} />
            </span>
            <span className="min-w-0 flex-1">
              <strong className="block text-sm">{copy(locale, 'سؤال یا مشکلی دارید؟', 'Need help?')}</strong>
              <span className="text-xs text-muted">{copy(locale, 'تیم پشتیبانی معمولاً در همان روز پاسخ می‌دهد.', 'Support usually replies the same day.')}</span>
            </span>
            <Forward size={17} className="text-subtle" />
          </Link>
        </div>
      </div>
    </div>
  );
}
