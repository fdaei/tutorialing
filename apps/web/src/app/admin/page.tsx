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
import { localePath } from '@/lib/i18n';
import type { AdminDashboard } from '@lingospeak/contracts';

const clampPercent = (value: number) => Math.min(100, Math.max(0, Math.round(value)));

export default function Admin() {
  const { locale } = useTranslations();
  const fa = locale === 'fa';
  const p = (href: string) => localePath(href, locale);
  const Arrow = fa ? ArrowLeft : ArrowRight;
  const query = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => api<AdminDashboard>('/admin/dashboard'),
  });
  const data = query.data;
  const number = (value = 0) => value.toLocaleString(fa ? 'fa-IR' : 'en-US');
  const money = (value = 0) => (fa ? `${number(value)} تومان` : new Intl.NumberFormat('en-US').format(value));

  const cards = [
    {
      label: fa ? 'درآمد ثبت‌شده' : 'Recorded revenue',
      value: money(data?.revenue),
      hint: fa ? `${number(data?.payments)} پرداخت` : `${number(data?.payments)} payments`,
      tone: 'text-emerald-600',
      icon: CircleDollarSign,
    },
    {
      label: fa ? 'کل رزروها' : 'Total bookings',
      value: fa ? `${number(data?.bookings)} جلسه` : `${number(data?.bookings)} sessions`,
      hint: fa ? 'داده زنده سامانه' : 'Live platform data',
      tone: 'text-blue',
      icon: CalendarCheck2,
    },
    {
      label: fa ? 'در انتظار تأیید' : 'Awaiting approval',
      value: fa ? `${number(data?.pendingTeachers)} مورد` : `${number(data?.pendingTeachers)} items`,
      hint: fa ? 'درخواست مدرس' : 'Teacher applications',
      tone: 'text-orange-500',
      icon: UserRoundCheck,
    },
    {
      label: fa ? 'تیکت باز' : 'Open tickets',
      value: fa ? `${number(data?.openTickets)} مورد` : `${number(data?.openTickets)} items`,
      hint: fa ? 'نیازمند پاسخ پشتیبانی' : 'Waiting for support',
      tone: 'text-red-500',
      icon: LifeBuoy,
    },
  ];

  const queue = [
    {
      title: fa
        ? `بررسی ${number(data?.pendingTeachers)} درخواست مدرس`
        : `Review ${number(data?.pendingTeachers)} teacher applications`,
      detail: fa ? 'تأیید هویت، مدارک و پروفایل' : 'Verify identity, documents, and profile',
      action: fa ? 'بررسی' : 'Review',
      href: '/admin/teacher-applications',
      icon: ShieldCheck,
    },
    {
      title: fa
        ? `ارزیابی ${number(data?.pendingReviews)} پاسخ آزمون`
        : `Evaluate ${number(data?.pendingReviews)} test answers`,
      detail: 'Writing & Speaking',
      action: fa ? 'ارزیابی' : 'Evaluate',
      href: '/admin/test-reviews',
      icon: BookOpenCheck,
    },
    {
      title: fa ? `پاسخ به ${number(data?.openTickets)} تیکت باز` : `Answer ${number(data?.openTickets)} open tickets`,
      detail: fa ? 'مرتب‌شده بر اساس زمان انتظار' : 'Sorted by waiting time',
      action: fa ? 'پاسخ' : 'Reply',
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
            {fa ? 'به‌روزرسانی داده‌ها' : 'Refresh data'}
          </button>
          <div className="order-1 text-start sm:order-2 sm:text-end">
            <p className="text-xs font-bold text-blue">
              {data?.statsUpdatedAt
                ? fa
                  ? `آخرین تغییر آمار: ${new Date(data.statsUpdatedAt).toLocaleString('fa-IR')}`
                  : `Metrics updated: ${new Date(data.statsUpdatedAt).toLocaleString('en-US')}`
                : fa
                  ? 'نمای سامانه'
                  : 'Platform overview'}
            </p>
            <h1 className="mt-2 text-3xl font-black">{fa ? 'مرکز عملیات' : 'Operations center'}</h1>
            <p className="mt-2 text-sm text-muted">
              {fa
                ? 'اولویت‌ها، وضعیت سامانه و تصمیم‌های امروز در یک نگاه'
                : 'Today’s priorities, platform health, and decisions at a glance'}
            </p>
          </div>
        </header>

        {query.isError && (
          <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
            {fa
              ? 'دریافت آمار ناموفق بود. اتصال API را بررسی کنید.'
              : 'Could not load dashboard metrics. Check the API connection.'}
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
                {fa ? 'مشاهده همه' : 'View all'}
              </Link>
              <div className="text-end">
                <h2 className="text-xl font-black">{fa ? 'صف عملیات امروز' : 'Today’s action queue'}</h2>
                <p className="mt-1 text-xs text-muted">
                  {fa ? 'مهم‌ترین کارها بر اساس فوریت' : 'Prioritized by urgency'}
                </p>
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
              <h2 className="text-xl font-black">{fa ? 'وضعیت عملیات' : 'Operations health'}</h2>
              <Clock3 size={20} className="text-blue" />
            </div>
            <div className="mt-6 grid gap-6">
              <HealthBar
                label={fa ? 'مدرس‌های تأییدشده' : 'Approved teachers'}
                value={teacherHealth}
                color="bg-emerald-500"
                locale={locale}
              />
              <HealthBar
                label={fa ? 'پاسخ‌های ارزیابی‌شده' : 'Reviewed test answers'}
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
                <strong className="block text-xs">{fa ? 'مرکز مالی و تسویه' : 'Finance & payouts'}</strong>
                <small className="mt-1 block text-amber-700">
                  {fa ? 'بررسی پرداخت‌ها و درخواست‌های تسویه' : 'Review payments and payout requests'}
                </small>
              </span>
            </Link>
          </article>
        </section>
      </div>
    </PanelShell>
  );
}

function HealthBar({ label, value, color, locale }: { label: string; value: number; color: string; locale: string }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs">
        <strong>{value.toLocaleString(locale === 'fa' ? 'fa-IR' : 'en-US')}٪</strong>
        <span className="text-muted">{label}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#ebedf7]">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
