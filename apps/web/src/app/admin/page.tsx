'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  CalendarCheck2,
  CircleDollarSign,
  Clock3,
  LifeBuoy,
  RefreshCw,
  ShieldCheck,
  UserRoundCheck,
} from 'lucide-react';
import { PanelShell, adminNav } from '@/features/panel/components/panel-shell';
import { api } from '@/lib/api';
import { useTranslations } from '@/components/shared/locale-provider';
import { localePath, localized, isDefaultLocale, translate, type Locale } from '@/lib/i18n';
import type { AdminDashboard } from '@lingospeak/contracts';

const clampPercent = (value: number) => Math.min(100, Math.max(0, Math.round(value)));

export default function Admin() {
  const { locale } = useTranslations();
  const fa = isDefaultLocale(locale);
  const p = (href: string) => localePath(href, locale);
  const Arrow = localized({ fa: ArrowLeft, en: ArrowRight }, locale);
  const query = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => api<AdminDashboard>('/admin/dashboard'),
  });
  const data = query.data;
  const number = (value = 0) => value.toLocaleString(translate(locale, 'commercepricingManagerEnUS2'));
  const money = (value = 0) =>
    localized({ fa: `${number(value)} تومان`, en: new Intl.NumberFormat('en-US').format(value) }, locale);

  const cards = [
    {
      label: translate(locale, 'adminRecordedRevenue'),
      value: money(data?.revenue),
      hint: localized({ fa: `${number(data?.payments)} پرداخت`, en: `${number(data?.payments)} payments` }, locale),
      tone: 'text-emerald-600',
      icon: CircleDollarSign,
    },
    {
      label: translate(locale, 'adminTotalBookings'),
      value: localized({ fa: `${number(data?.bookings)} جلسه`, en: `${number(data?.bookings)} sessions` }, locale),
      hint: translate(locale, 'adminLivePlatformData'),
      tone: 'text-blue',
      icon: CalendarCheck2,
    },
    {
      label: translate(locale, 'adminAwaitingApproval'),
      value: localized(
        { fa: `${number(data?.pendingTeachers)} مورد`, en: `${number(data?.pendingTeachers)} items` },
        locale,
      ),
      hint: translate(locale, 'adminTeacherApplications'),
      tone: 'text-orange-500',
      icon: UserRoundCheck,
    },
    {
      label: translate(locale, 'adminOpenTickets'),
      value: localized({ fa: `${number(data?.openTickets)} مورد`, en: `${number(data?.openTickets)} items` }, locale),
      hint: translate(locale, 'adminWaitingForSupport'),
      tone: 'text-red-500',
      icon: LifeBuoy,
    },
  ];

  const queue = [
    {
      title: localized(
        {
          fa: `بررسی ${number(data?.pendingTeachers)} درخواست مدرس`,
          en: `Review ${number(data?.pendingTeachers)} teacher applications`,
        },
        locale,
      ),
      detail: translate(locale, 'adminVerifyIdentityDocumentsAndProfile'),
      action: translate(locale, 'teacherteacherDashboardReview'),
      href: '/admin/teacher-applications',
      icon: ShieldCheck,
    },
    {
      title: localized(
        {
          fa: `ارزیابی ${number(data?.pendingReviews)} پاسخ آزمون`,
          en: `Evaluate ${number(data?.pendingReviews)} test answers`,
        },
        locale,
      ),
      detail: 'Writing & Speaking',
      action: translate(locale, 'adminEvaluate'),
      href: '/admin/test-reviews',
      icon: BookOpenCheck,
    },
    {
      title: localized(
        { fa: `پاسخ به ${number(data?.openTickets)} تیکت باز`, en: `Answer ${number(data?.openTickets)} open tickets` },
        locale,
      ),
      detail: translate(locale, 'adminSortedByWaitingTime'),
      action: translate(locale, 'adminReply'),
      href: '/admin/tickets',
      icon: LifeBuoy,
    },
  ];

  const teacherHealth = clampPercent(
    ((data?.activeTeachers ?? 0) / Math.max(1, (data?.activeTeachers ?? 0) + (data?.pendingTeachers ?? 0))) * 100,
  );
  const reviewHealth = clampPercent(
    (((data?.testAttempts ?? 0) - (data?.pendingReviews ?? 0)) / Math.max(1, data?.testAttempts ?? 0)) * 100,
  );

  return (
    <PanelShell title="مدیریت لینگواسپیک" items={adminNav}>
      <div className="admin-command-center">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => query.refetch()}
            disabled={query.isFetching}
            className="secondary-button order-2 self-start sm:order-1"
          >
            <RefreshCw size={16} className={query.isFetching ? 'animate-spin' : ''} />
            {translate(locale, 'adminRefreshData')}
          </button>
          <div className="order-1 text-start sm:order-2 sm:text-end">
            <p className="text-xs font-bold text-blue">
              {data?.statsUpdatedAt
                ? localized(
                    {
                      fa: `آخرین تغییر آمار: ${new Date(data.statsUpdatedAt).toLocaleString('fa-IR')}`,
                      en: `Metrics updated: ${new Date(data.statsUpdatedAt).toLocaleString('en-US')}`,
                    },
                    locale,
                  )
                : translate(locale, 'adminPlatformOverview')}
            </p>
            <h1 className="mt-2 text-3xl font-black">{translate(locale, 'adminOperationsCenter')}</h1>
            <p className="mt-2 text-sm text-muted">
              {translate(locale, 'adminTodaySPrioritiesPlatformHealthAndDecisionsAt')}
            </p>
          </div>
        </header>

        {query.isError && (
          <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
            {translate(locale, 'adminCouldNotLoadDashboardMetricsCheckTheAPI')}
          </div>
        )}

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map(({ label, value, hint, tone, icon: Icon }) => (
            <article key={label} className="panel-card admin-kpi p-5">
              <div className="flex items-start justify-between gap-4">
                <span className={`grid size-10 place-items-center rounded-xl bg-[#f5f7ff] ${tone}`}>
                  <Icon size={19} />
                </span>
                <div className="text-end">
                  <p className="text-xs text-muted">{label}</p>
                  <strong className="mt-2 block text-xl font-black">{query.isLoading ? '—' : value}</strong>
                </div>
              </div>
              <small className={`mt-4 block text-end font-bold ${tone}`}>{hint}</small>
            </article>
          ))}
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_350px]">
          <article className="panel-card overflow-hidden p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <Link href={p('/admin/search')} className="text-xs font-bold text-blue">
                {translate(locale, 'adminViewAll')}
              </Link>
              <div className="text-end">
                <h2 className="text-xl font-black">{translate(locale, 'adminTodaySActionQueue')}</h2>
                <p className="mt-1 text-xs text-muted">{translate(locale, 'adminPrioritizedByUrgency')}</p>
              </div>
            </div>
            <div className="mt-4 divide-y hairline">
              {queue.map(({ title, detail, action, href, icon: Icon }) => (
                <div key={href} className="flex items-center gap-3 py-4 sm:gap-4">
                  <Link href={p(href)} className="secondary-button !px-3 !py-2 text-xs text-blue">
                    {action}
                  </Link>
                  <div className="min-w-0 flex-1 text-end">
                    <strong className="block truncate text-sm">{title}</strong>
                    <small className="mt-1 block truncate text-muted">{detail}</small>
                  </div>
                  <span className="grid size-10 flex-none place-items-center rounded-xl bg-[#f0f2ff] text-blue">
                    <Icon size={18} />
                  </span>
                </div>
              ))}
            </div>
          </article>

          <article className="panel-card p-5 sm:p-6">
            <div className="flex items-center justify-end gap-3">
              <h2 className="text-xl font-black">{translate(locale, 'adminOperationsHealth')}</h2>
              <Clock3 size={20} className="text-blue" />
            </div>
            <div className="mt-6 grid gap-6">
              <HealthBar
                label={translate(locale, 'adminApprovedTeachers')}
                value={teacherHealth}
                color="bg-emerald-500"
                locale={locale}
              />
              <HealthBar
                label={translate(locale, 'adminReviewedTestAnswers')}
                value={reviewHealth}
                color="bg-blue"
                locale={locale}
              />
            </div>
            <Link
              href={p('/admin/finance')}
              className="mt-7 flex items-center justify-between rounded-xl bg-amber-50 p-4 text-amber-900"
            >
              <Arrow size={16} />
              <span className="text-end">
                <strong className="block text-xs">{translate(locale, 'adminFinancePayouts')}</strong>
                <small className="mt-1 block text-amber-700">
                  {translate(locale, 'adminReviewPaymentsAndPayoutRequests')}
                </small>
              </span>
            </Link>
          </article>
        </section>
      </div>
    </PanelShell>
  );
}

function HealthBar({ label, value, color, locale }: { label: string; value: number; color: string; locale: Locale }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs">
        <strong>{value.toLocaleString(translate(locale, 'commercepricingManagerEnUS2'))}٪</strong>
        <span className="text-muted">{label}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#ebedf7]">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
