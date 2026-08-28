'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FileCheck2,
  Users,
} from 'lucide-react';
import { api } from '@/shared/services/api';
import { localePath, localized, isDefaultLocale, translate } from '@/lib/i18n';
import { useTranslations } from '@/components/shared/locale-provider';

type Row = Record<string, unknown>;
type Finance = { earnings?: { netAmount: number; status: string }[] };
type Application = { status?: string; verificationItems?: { status: string }[] };
const rows = (value: unknown): Row[] =>
  Array.isArray(value)
    ? (value as Row[])
    : value && typeof value === 'object' && Array.isArray((value as { data?: unknown }).data)
      ? (value as { data: Row[] }).data
      : [];

export function TeacherDashboard() {
  const { locale } = useTranslations(),
    fa = isDefaultLocale(locale),
    p = (href: string) => localePath(href, locale),
    Arrow = localized({ fa: ArrowLeft, en: ArrowRight }, locale);
  const bookings = useQuery({ queryKey: ['/bookings/me'], queryFn: () => api<unknown>('/bookings/me') });
  const finance = useQuery({ queryKey: ['/teacher/finance'], queryFn: () => api<Finance>('/teacher/finance') });
  const application = useQuery({
    queryKey: ['/teacher/application'],
    queryFn: () => api<Application>('/teacher/application'),
  });
  const all = rows(bookings.data),
    now = Date.now(),
    upcoming = all
      .filter(
        (item) =>
          new Date(String(item.startsAt)).getTime() >= now && !['CANCELLED', 'COMPLETED'].includes(String(item.status)),
      )
      .sort((a, b) => new Date(String(a.startsAt)).getTime() - new Date(String(b.startsAt)).getTime());
  const completed = all.filter((item) => item.status === 'COMPLETED').length,
    students = new Set(all.map((item) => String(item.studentId ?? '')).filter(Boolean)).size;
  const balance = (finance.data?.earnings ?? [])
    .filter((item) => item.status !== 'PAID')
    .reduce((sum, item) => sum + item.netAmount, 0);
  const verified = application.data?.status === 'APPROVED',
    docs = (application.data?.verificationItems ?? []).filter((item) => item.status === 'APPROVED').length;
  const number = (value: number) =>
      new Intl.NumberFormat(translate(locale, 'commercepricingManagerEnUS2')).format(value),
    money = (value: number) => `${number(value)} ${translate(locale, 'teacherteacherFinanceIrr')}`;
  return (
    <div className="teacher-workspace">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-sm font-bold text-blue">
            {translate(locale, 'teacherteacherDashboardTeacherWorkspace')}
          </p>
          <h1 className="text-3xl font-black md:text-4xl">
            {translate(locale, 'teacherteacherDashboardHereSYourTeachingDay')}
          </h1>
          <p className="mt-2 text-muted">
            {translate(locale, 'teacherteacherDashboardYourNextClassEssentialTasksAndEarningsIn')}
          </p>
        </div>
        <Link href={p('/teacher-panel/availability')} className="secondary-button">
          <CalendarClock size={18} />
          {translate(locale, 'teacherteacherDashboardManageSchedule')}
        </Link>
      </header>
      <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          icon={CalendarClock}
          label={translate(locale, 'teacherteacherDashboardUpcomingClasses')}
          value={number(upcoming.length)}
          tone="blue"
        />
        <Stat
          icon={CheckCircle2}
          label={translate(locale, 'teacherteacherDashboardCompletedClasses')}
          value={number(completed)}
          tone="green"
        />
        <Stat
          icon={Users}
          label={translate(locale, 'teacherteacherDashboardStudents')}
          value={number(students)}
          tone="purple"
        />
        <Stat
          icon={CircleDollarSign}
          label={translate(locale, 'teacherteacherDashboardAvailableBalance')}
          value={money(balance)}
          tone="orange"
        />
      </section>
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.55fr_.85fr]">
        <section className="panel-card p-5 md:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black">{translate(locale, 'teacherteacherDashboardNextClass')}</h2>
              <p className="mt-1 text-sm text-muted">
                {translate(locale, 'teacherteacherDashboardEverythingYouNeedToGetStarted')}
              </p>
            </div>
            <Link href={p('/teacher-panel/classes')} className="text-sm font-bold text-blue">
              {translate(locale, 'teacherteacherDashboardAllClasses')}
            </Link>
          </div>
          {bookings.isLoading ? (
            <div className="skeleton mt-6 h-44 rounded-2xl" />
          ) : upcoming[0] ? (
            <NextClass item={upcoming[0]} fa={fa} />
          ) : (
            <Empty
              icon={CalendarClock}
              title={translate(locale, 'teacherteacherDashboardNoUpcomingClass')}
              text={translate(locale, 'teacherteacherDashboardReviewYourScheduleToKeepBookableTimesOpen')}
            />
          )}
        </section>
        <section className="panel-card p-5 md:p-6">
          <h2 className="text-xl font-black">{translate(locale, 'teacherteacherDashboardActionRequired')}</h2>
          <p className="mt-1 text-sm text-muted">
            {translate(locale, 'teacherteacherDashboardItemsAffectingYourProfileVisibility')}
          </p>
          <div className="mt-5 grid gap-3">
            <Task
              done={verified}
              title={translate(locale, 'teacherteacherDashboardTeacherVerification')}
              detail={
                verified
                  ? translate(locale, 'teacherteacherDashboardYourAccountIsVerified')
                  : localized({ fa: `${number(docs)} مدرک تأیید شده`, en: `${docs} approved documents` }, locale)
              }
              href={p('/teacher-panel/profile')}
              fa={fa}
            />
            <Task
              done={Boolean(upcoming.length)}
              title={translate(locale, 'teacherteacherDashboardBookableSchedule')}
              detail={
                upcoming.length
                  ? translate(locale, 'teacherteacherDashboardYourScheduleIsActive')
                  : translate(locale, 'teacherteacherDashboardAddTeachingHours')
              }
              href={p('/teacher-panel/availability')}
              fa={fa}
            />
          </div>
        </section>
      </div>
      <section className="mt-5 panel-card p-5 md:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black">{translate(locale, 'teacherteacherDashboardQuickActions')}</h2>
            <p className="mt-1 text-sm text-muted">
              {translate(locale, 'teacherteacherDashboardFrequentTasksWithoutDiggingThroughMenus')}
            </p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Quick
            href={p('/teacher-panel/classes')}
            icon={CheckCircle2}
            text={translate(locale, 'teacherteacherDashboardRecordAttendance')}
            Arrow={Arrow}
          />
          <Quick
            href={p('/teacher-panel/plans')}
            icon={FileCheck2}
            text={translate(locale, 'teacherteacherDashboardCreateAssignment')}
            Arrow={Arrow}
          />
          <Quick
            href={p('/teacher-panel/availability')}
            icon={Clock3}
            text={translate(locale, 'teacherteacherDashboardBlockATime')}
            Arrow={Arrow}
          />
          <Quick
            href={p('/teacher-panel/earnings')}
            icon={CircleDollarSign}
            text={translate(locale, 'teacherteacherDashboardViewFinances')}
            Arrow={Arrow}
          />
        </div>
      </section>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <article className="panel-card flex items-center gap-4 p-5">
      <span className={`teacher-stat-icon teacher-stat-${tone}`}>
        <Icon size={22} />
      </span>
      <div>
        <p className="text-sm text-muted">{label}</p>
        <strong className="mt-1 block text-2xl font-black">{value}</strong>
      </div>
    </article>
  );
}
function NextClass({ item, fa }: { item: Row; fa: boolean }) {
  const start = new Date(String(item.startsAt)),
    end = new Date(String(item.endsAt)),
    student = item.student && typeof item.student === 'object' ? (item.student as Row) : {};
  return (
    <div className="mt-6 rounded-2xl bg-[#f5f7ff] p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="status-pill status-info">
            {String(item.type) === 'trial'
              ? translate(fa, 'teacherteacherDashboardTrial')
              : translate(fa, 'teacherteacherDashboardRegular')}
          </span>
          <h3 className="mt-3 text-xl font-black">
            {String(student.name ?? translate(fa, 'schedulingteacherPlannerCalendarStudent'))}
          </h3>
          <p className="mt-1 text-sm text-muted">
            {new Intl.DateTimeFormat(translate(fa, 'commercepricingManagerEnUS2'), {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            }).format(start)}
          </p>
        </div>
        <div className="rounded-2xl bg-white px-6 py-4 text-center shadow-sm">
          <strong className="latin text-2xl">
            {start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </strong>
          <p className="mt-1 text-xs text-muted">
            {Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000))}{' '}
            {translate(fa, 'teacherteacherDashboardMin')}
          </p>
        </div>
      </div>
    </div>
  );
}
function Empty({ icon: Icon, title, text }: { icon: React.ElementType; title: string; text: string }) {
  return (
    <div className="mt-6 grid min-h-40 place-items-center rounded-2xl border border-dashed hairline text-center">
      <div>
        <Icon className="mx-auto text-muted" />
        <strong className="mt-3 block">{title}</strong>
        <p className="mt-1 text-sm text-muted">{text}</p>
      </div>
    </div>
  );
}
function Task({
  done,
  title,
  detail,
  href,
  fa,
}: {
  done: boolean;
  title: string;
  detail: string;
  href: string;
  fa: boolean;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-2xl border hairline p-4 hover:border-indigo-200 hover:bg-indigo-50/40"
    >
      <span
        className={`grid size-9 place-items-center rounded-full ${done ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}
      >
        {done ? <CheckCircle2 size={19} /> : <Clock3 size={19} />}
      </span>
      <span className="flex-1">
        <strong className="block text-sm">{title}</strong>
        <small className="text-muted">{detail}</small>
      </span>
      <span className="text-xs font-bold text-blue">{translate(fa, 'teacherteacherDashboardReview')}</span>
    </Link>
  );
}
function Quick({
  href,
  icon: Icon,
  text,
  Arrow,
}: {
  href: string;
  icon: React.ElementType;
  text: string;
  Arrow: React.ElementType;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-2xl bg-[#f7f8fc] p-4 font-bold hover:bg-[#eef2ff] hover:text-blue"
    >
      <Icon size={19} />
      <span className="flex-1">{text}</span>
      <Arrow size={16} />
    </Link>
  );
}
