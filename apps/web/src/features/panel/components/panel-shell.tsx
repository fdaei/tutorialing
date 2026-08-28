'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '@/shared/services/api';
import {
  Bell,
  BookOpen,
  CalendarDays,
  ChevronDown,
  CreditCard,
  FileCheck,
  FileEdit,
  Grid2X2,
  HelpCircle,
  Home,
  LifeBuoy,
  LogOut,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Search,
  Settings,
  ShieldCheck,
  TicketCheck,
  Users,
  X,
} from 'lucide-react';
import { LanguageSwitcher } from '@/components/shared/language-switcher';
import { useTranslations } from '@/components/shared/locale-provider';
import { localePath, localized, isDefaultLocale, translate } from '@/lib/i18n';
import type { AdminDashboard } from '@lingospeak/contracts';
import { clearAuthSession } from '@/shared/services/api';

export type NavItem = {
  href: string;
  label: string;
  labelEn: string;
  icon?: React.ElementType;
  roles?: string[];
  permission?: string;
};

export function PanelShell({ title, items, children }: { title: string; items: NavItem[]; children: React.ReactNode }) {
  const router = useRouter(),
    path = usePathname(),
    [open, setOpen] = useState(false),
    [moreOpen, setMoreOpen] = useState(false),
    { locale } = useTranslations(),
    fa = isDefaultLocale(locale),
    p = (href: string) => localePath(href, locale);
  const me = useQuery({
    queryKey: ['panel-me'],
    queryFn: () =>
      api<{ name?: string; avatarUrl?: string | null; roles: string[]; permissions: string[] }>('/users/me'),
    retry: false,
  });
  useEffect(() => {
    if (me.error instanceof ApiError && me.error.status === 401)
      router.replace(`/auth?next=${encodeURIComponent(location.pathname)}`);
  }, [me.error, router]);
  const adminMode = path.includes('/admin'),
    teacherMode = path.includes('/teacher-panel'),
    allowed = adminMode
      ? ['ADMIN', 'STAFF', 'SUPPORT', 'FINANCE', 'EXAMINER']
      : teacherMode
        ? ['TEACHER', 'ADMIN']
        : [];
  const roles = Array.isArray(me.data?.roles) ? me.data.roles : [];
  const permissions = Array.isArray(me.data?.permissions) ? me.data.permissions : [];
  const canSee = (item: NavItem) =>
    (!item.roles || item.roles.some((role) => roles.includes(role))) &&
    (!item.permission || permissions.includes(item.permission));
  const visibleItems = items.filter(canSee);
  const currentItem = [...items]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => {
      const href = p(item.href);
      return (
        path === href ||
        (item.href !== '/admin' &&
          item.href !== '/dashboard' &&
          item.href !== '/teacher-panel' &&
          path.startsWith(`${href}/`))
      );
    });
  const primaryRole = roles.includes('ADMIN')
    ? 'ADMIN'
    : roles.includes('STAFF')
      ? 'STAFF'
      : roles.includes('SUPPORT')
        ? 'SUPPORT'
        : roles.includes('FINANCE')
          ? 'FINANCE'
          : roles.includes('EXAMINER')
            ? 'EXAMINER'
            : roles.includes('TEACHER')
              ? 'TEACHER'
              : 'STUDENT';
  const roleLabels: Record<string, [string, string]> = {
    ADMIN: ['مدیر کل', 'Administrator'],
    STAFF: ['کارشناس مدیریت', 'Staff'],
    SUPPORT: ['پشتیبان', 'Support'],
    FINANCE: ['کارشناس مالی', 'Finance'],
    EXAMINER: ['ارزیاب آزمون', 'Examiner'],
    TEACHER: ['مدرس', 'Teacher'],
    STUDENT: ['زبان‌آموز', 'Student'],
  };
  const roleLabel: [string, string] = roleLabels[primaryRole] ?? ['زبان‌آموز', 'Student'];
  const notificationItem = visibleItems.find((item) => item.href.endsWith('/notifications'));
  const showAdminSearch = adminMode && roles.some((role) => ['ADMIN', 'STAFF'].includes(role));
  const adminSummary = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => api<AdminDashboard>('/admin/dashboard'),
    enabled: adminMode && roles.some((role) => ['ADMIN', 'STAFF'].includes(role)),
  });
  // Never render account navigation or page content until authentication has
  // been confirmed. In particular, a 401 used to trigger the redirect above
  // while briefly exposing the panel shell and its children.
  if (me.isLoading || !me.data) return <div className="skeleton min-h-screen" />;
  if (me.data && ((allowed.length && !roles.some((r) => allowed.includes(r))) || (currentItem && !canSee(currentItem))))
    return (
      <main className="grid min-h-screen place-items-center">
        <div className="panel-card p-10 text-center">
          <ShieldCheck className="mx-auto text-red-500" />
          <h1 className="mt-4 text-2xl font-black">{translate(locale, 'panelpanelShellAccessDenied')}</h1>
          <Link href={p('/panel')} className="mt-5 inline-block text-blue">
            {translate(locale, 'panelpanelShellOpenMyWorkspace')}
          </Link>
        </div>
      </main>
    );

  const displayTitle = adminMode
    ? primaryRole === 'SUPPORT'
      ? translate(locale, 'panelpanelShellSupportWorkspace')
      : primaryRole === 'FINANCE'
        ? translate(locale, 'panelpanelShellFinanceWorkspace')
        : primaryRole === 'EXAMINER'
          ? translate(locale, 'panelpanelShellExaminerWorkspace')
          : translate(locale, 'panelpanelShellLingospeakAdministration')
    : teacherMode
      ? translate(locale, 'panelpanelShellTeacherPanel')
      : translate(locale, 'panelpanelShellStudentDashboard');
  const isActive = (href: string, children: string[] = []) =>
    [href, ...children].some((value) => {
      const localized = p(value);
      return path === localized || (value !== '/admin' && path.startsWith(`${localized}/`));
    });
  const adminWorkspace = [
    { href: '/admin', label: 'نمای کلی', labelEn: 'Overview', icon: Grid2X2, children: [] },
    { href: '/admin/users', label: 'کاربران و مدرس‌ها', labelEn: 'People', icon: Users, children: ['/admin/teachers'] },
    {
      href: '/admin/teacher-applications',
      label: 'تأیید و محتوا',
      labelEn: 'Approvals & content',
      icon: FileCheck,
      children: ['/admin/teacher-documents', '/admin/teacher-prices', '/admin/tests', '/admin/test-reviews'],
      badge: adminSummary.data?.pendingTeachers,
    },
    {
      href: '/admin/bookings',
      label: 'رزرو و تقویم',
      labelEn: 'Bookings & calendar',
      icon: CalendarDays,
      children: ['/admin/availability-blocks'],
    },
    {
      href: '/admin/finance',
      label: 'مالی و تسویه',
      labelEn: 'Finance & payouts',
      icon: CreditCard,
      children: ['/admin/payments', '/admin/discounts', '/admin/refunds', '/admin/teacher-earnings', '/admin/payouts'],
    },
    {
      href: '/admin/tickets',
      label: 'پشتیبانی',
      labelEn: 'Support',
      icon: LifeBuoy,
      children: [],
      badge: adminSummary.data?.openTickets,
    },
  ].filter((group) => visibleItems.some((item) => item.href === group.href || group.children.includes(item.href)));
  const workspaceHrefs = new Set(adminWorkspace.flatMap((group) => [group.href, ...group.children]));
  const moreItems = visibleItems.filter(
    (item) => !workspaceHrefs.has(item.href) && item.href !== '/admin/notifications',
  );
  const Sidebar = () => (
    <aside className={`flex h-full flex-col p-4 ${adminMode ? 'admin-sidebar text-white' : 'bg-white text-navy'}`}>
      <Link href={p('/')} className="flex items-center gap-3 px-2 py-2">
        <span
          className={`grid size-11 place-items-center rounded-2xl ${adminMode ? 'bg-blue text-white' : 'brand-gradient text-white shadow-lg'}`}
        >
          <MessageCircle size={22} />
        </span>
        <span>
          <strong className="latin block text-xl">LingoSpeak</strong>
          <small className={adminMode ? 'text-white/50' : 'text-muted'}>{displayTitle}</small>
        </span>
      </Link>
      {adminMode ? (
        <nav className="mt-7 flex min-h-0 flex-1 flex-col">
          <small className="px-3 pb-2 text-[11px] font-bold text-white/45">
            {translate(locale, 'panelpanelShellWorkspace')}
          </small>
          <div className="grid gap-1.5">
            {adminWorkspace.map((group) => {
              const Icon = group.icon,
                active = isActive(group.href, group.children);
              return (
                <Link
                  onClick={() => setOpen(false)}
                  key={group.href}
                  href={p(group.href)}
                  className={`admin-nav-item ${active ? 'admin-nav-active' : ''}`}
                >
                  <Icon size={18} />
                  <span className="flex-1">{localized({ fa: group.label, en: group.labelEn }, locale)}</span>
                  {Boolean(group.badge) && (
                    <span className="admin-nav-badge">
                      {Number(group.badge).toLocaleString(translate(locale, 'commercepricingManagerEnUS2'))}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
          <div className="mt-auto pt-4">
            <button
              type="button"
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen((value) => !value)}
              className="admin-nav-item w-full border border-white/15"
            >
              <MoreHorizontal size={18} />
              <span className="flex-1 text-start">{translate(locale, 'teacherteacherMoreMore')}</span>
              <ChevronDown size={16} className={`transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
            </button>
            {moreOpen && (
              <div className="admin-more-menu">
                {moreItems.map((item) => {
                  const Icon = item.icon ?? Home;
                  return (
                    <Link
                      onClick={() => setOpen(false)}
                      key={item.href}
                      href={p(item.href)}
                      className={isActive(item.href) ? 'text-white' : 'text-white/60'}
                    >
                      <Icon size={16} />
                      <span>{localized({ fa: item.label, en: item.labelEn }, locale)}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </nav>
      ) : (
        <nav className="mt-8 grid gap-1.5">
          {visibleItems.map((item) => {
            const Icon = item.icon ?? Home,
              href = p(item.href);
            const active = isActive(item.href);
            return (
              <Link
                onClick={() => setOpen(false)}
                key={item.href}
                href={href}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold ${active ? 'bg-[#eef2ff] text-blue' : 'text-muted hover:bg-[#f5f6fb] hover:text-navy'}`}
              >
                <Icon size={19} />
                <span className="flex-1">{localized({ fa: item.label, en: item.labelEn }, locale)}</span>
                {active && <span className="size-2 rounded-full bg-blue" />}
              </Link>
            );
          })}
        </nav>
      )}
      {me.data && (roles.includes('TEACHER') || roles.includes('ADMIN')) && (
        <div className={`mt-5 rounded-2xl p-3 ${adminMode ? 'bg-white/[.07]' : 'bg-[#f7f8fc]'}`}>
          <small className={`mb-2 block px-1 text-[11px] font-bold ${adminMode ? 'text-white/45' : 'text-muted'}`}>
            {translate(locale, 'panelpanelShellSwitchWorkspace')}
          </small>
          <div className="grid gap-1">
            <Link
              href={p('/dashboard')}
              className="flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-bold hover:bg-blue/10"
            >
              <Home size={15} /> {translate(locale, 'panelpanelShellUserDashboard')}
            </Link>
            {roles.includes('TEACHER') && (
              <Link
                href={p('/teacher-panel')}
                className="flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-bold hover:bg-blue/10"
              >
                <BookOpen size={15} /> {translate(locale, 'panelpanelShellTeacherPanel')}
              </Link>
            )}
            {roles.includes('ADMIN') && (
              <Link
                href={p('/admin')}
                className="flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-bold hover:bg-blue/10"
              >
                <ShieldCheck size={15} /> {translate(locale, 'panelpanelShellAdminPanel')}
              </Link>
            )}
          </div>
        </div>
      )}
      <div className={`mt-3 rounded-2xl p-3 ${adminMode ? 'bg-white/[.07]' : 'bg-[#f7f8fc]'}`}>
        <div className="flex items-center gap-3">
          <span className="brand-gradient grid size-9 shrink-0 overflow-hidden place-items-center rounded-full font-black text-white">
            {me.data?.avatarUrl ? (
              <img src={me.data.avatarUrl} alt="" className="size-full object-cover" />
            ) : (
              (me.data?.name ?? 'L').slice(0, 1)
            )}
          </span>
          <span className="min-w-0 flex-1">
            <strong className="block truncate text-xs">
              {me.data?.name ?? roleLabel[localized({ fa: 0, en: 1 }, locale)]}
            </strong>
            <small className={adminMode ? 'text-white/45' : 'text-muted'}>
              {roleLabel[localized({ fa: 0, en: 1 }, locale)]}
            </small>
          </span>
        </div>
      </div>
      <button
        onClick={async () => {
          await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
          clearAuthSession();
          router.replace(p('/'));
        }}
        className={`mt-2 flex items-center gap-3 rounded-xl px-4 py-3 text-sm ${adminMode ? 'text-white/55 hover:bg-white/10' : 'text-red-500'}`}
      >
        <LogOut size={18} />
        {translate(locale, 'panelpanelShellSignOut')}
      </button>
    </aside>
  );

  return (
    <div className="min-h-screen bg-[#f8f9fd]">
      <div
        className={`fixed inset-y-0 z-30 hidden hairline lg:block ${adminMode ? 'w-[260px]' : 'w-[252px]'} ${translate(locale, 'panelpanelShellLeft0BorderR')}`}
      >
        <Sidebar />
      </div>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/25 backdrop-blur-sm lg:hidden" onClick={() => setOpen(false)}>
          <div className="h-full w-[285px] max-w-[85vw]" onClick={(e) => e.stopPropagation()}>
            <button
              className={`absolute top-4 z-10 grid size-9 place-items-center rounded-full bg-white shadow ${translate(locale, 'panelpanelShellRight4')}`}
              onClick={() => setOpen(false)}
              aria-label={translate(locale, 'adminadminUsersManagerClose')}
            >
              <X />
            </button>
            <Sidebar />
          </div>
        </div>
      )}
      <main
        className={`min-w-0 ${localized({ fa: adminMode ? 'lg:mr-[260px]' : 'lg:mr-[252px]', en: adminMode ? 'lg:ml-[260px]' : 'lg:ml-[252px]' }, locale)}`}
      >
        <header className="sticky top-0 z-20 flex h-[72px] items-center gap-4 border-b hairline bg-white/95 px-5 backdrop-blur-xl md:px-8">
          <button
            className="lg:hidden"
            onClick={() => setOpen(true)}
            aria-label={translate(locale, 'panelpanelShellMenu')}
          >
            <Menu />
          </button>
          {(!adminMode || showAdminSearch) && (
            <div className="hidden w-full max-w-md items-center gap-2 rounded-xl border hairline bg-[#f7faff] px-4 py-2.5 text-muted md:flex">
              <Search size={18} />
              <span className="truncate text-sm">
                {adminMode
                  ? translate(locale, 'panelpanelShellSearchUsersBookingsAndTickets')
                  : translate(locale, 'panelpanelShellSearchClassesLessonsAndTeachers')}
              </span>
            </div>
          )}
          <div className={`${translate(locale, 'panelpanelShellMlAuto')} flex items-center gap-3`}>
            <LanguageSwitcher className="rounded-xl border hairline px-2 py-1.5" />
            <button
              className="grid size-9 place-items-center text-muted"
              aria-label={translate(locale, 'panelpanelShellHelp')}
            >
              <HelpCircle size={19} />
            </button>
            {notificationItem && (
              <Link
                href={p(notificationItem.href)}
                className="relative grid size-9 place-items-center rounded-xl bg-[#f5f7ff]"
                aria-label={translate(locale, 'teacherteacherMoreNotifications')}
              >
                <Bell size={19} />
                <span className="absolute right-1 top-1 size-2 rounded-full bg-purple ring-2 ring-white" />
              </Link>
            )}
          </div>
        </header>
        <div className={`mx-auto p-4 sm:p-6 md:p-8 ${adminMode ? 'max-w-[1320px]' : 'max-w-[1500px]'}`}>
          <div className="reveal">{children}</div>
        </div>
      </main>
    </div>
  );
}

export const studentNav: NavItem[] = [
  { href: '/dashboard', label: 'داشبورد', labelEn: 'Dashboard', icon: Grid2X2 },
  { href: '/dashboard/plan', label: 'برنامه یادگیری', labelEn: 'Learning plan', icon: BookOpen },
  { href: '/dashboard/classes', label: 'کلاس‌ها', labelEn: 'Classes', icon: CalendarDays },
  { href: '/dashboard/matches', label: 'مدرس‌ها', labelEn: 'Teachers', icon: Users },
  { href: '/dashboard/tests', label: 'آزمون‌ها', labelEn: 'Tests', icon: FileCheck },
  { href: '/dashboard/tickets', label: 'تیکت‌ها', labelEn: 'Tickets', icon: LifeBuoy },
  { href: '/dashboard/wallet', label: 'مالی', labelEn: 'Payments', icon: CreditCard },
  { href: '/dashboard/profile', label: 'تنظیمات', labelEn: 'Settings', icon: Settings },
];
export const teacherNav: NavItem[] = [
  { href: '/teacher-panel', label: 'داشبورد', labelEn: 'Dashboard', icon: Grid2X2 },
  { href: '/teacher-panel/profile', label: 'پروفایل و تأیید', labelEn: 'Profile & verification', icon: FileCheck },
  { href: '/teacher-panel/availability', label: 'برنامه کاری', labelEn: 'Schedule', icon: CalendarDays },
  { href: '/teacher-panel/classes', label: 'کلاس‌ها', labelEn: 'Classes', icon: BookOpen },
  { href: '/teacher-panel/students', label: 'زبان‌آموزان', labelEn: 'Students', icon: Users },
  { href: '/teacher-panel/magazine', label: 'مجله', labelEn: 'Magazine', icon: FileEdit },
  { href: '/teacher-panel/earnings', label: 'مالی', labelEn: 'Finance', icon: CreditCard },
  { href: '/teacher-panel/more', label: 'بیشتر', labelEn: 'More', icon: MoreHorizontal },
];
export const adminNav: NavItem[] = [
  { href: '/admin', label: 'داشبورد', labelEn: 'Dashboard', icon: Grid2X2, roles: ['ADMIN', 'STAFF'] },
  { href: '/admin/magazine', label: 'بررسی مجله', labelEn: 'Magazine review', icon: FileEdit, roles: ['ADMIN', 'STAFF'], permission: 'cms.manage' },
  { href: '/admin/search', label: 'جستجوی سراسری', labelEn: 'Global search', icon: Search, roles: ['ADMIN', 'STAFF'] },
  {
    href: '/admin/users',
    label: 'کاربران',
    labelEn: 'Users',
    icon: Users,
    roles: ['ADMIN', 'STAFF'],
    permission: 'users.read',
  },
  {
    href: '/admin/teachers',
    label: 'مدرس‌ها',
    labelEn: 'Teachers',
    icon: Users,
    roles: ['ADMIN', 'STAFF'],
    permission: 'teachers.verify',
  },
  {
    href: '/admin/teacher-applications',
    label: 'درخواست‌های مدرس',
    labelEn: 'Teacher applications',
    icon: FileCheck,
    roles: ['ADMIN', 'STAFF'],
    permission: 'teachers.verify',
  },
  {
    href: '/admin/teacher-documents',
    label: 'مدارک مدرس',
    labelEn: 'Teacher documents',
    icon: FileCheck,
    roles: ['ADMIN', 'STAFF'],
    permission: 'teachers.verify',
  },
  {
    href: '/admin/teacher-prices',
    label: 'تأیید قیمت مدرس',
    labelEn: 'Teacher price approvals',
    icon: CreditCard,
    roles: ['ADMIN', 'STAFF', 'FINANCE'],
    permission: 'teacher-prices.manage',
  },
  {
    href: '/admin/languages',
    label: 'زبان‌ها',
    labelEn: 'Languages',
    roles: ['ADMIN', 'STAFF'],
    permission: 'languages.manage',
  },
  {
    href: '/admin/countries',
    label: 'کشورها',
    labelEn: 'Countries',
    roles: ['ADMIN', 'STAFF'],
    permission: 'languages.manage',
  },
  {
    href: '/admin/tests',
    label: 'آزمون‌ها',
    labelEn: 'Tests',
    icon: BookOpen,
    roles: ['ADMIN', 'STAFF'],
    permission: 'tests.manage',
  },
  {
    href: '/admin/test-reviews',
    label: 'تصحیح آزمون',
    labelEn: 'Test reviews',
    icon: FileCheck,
    roles: ['ADMIN', 'EXAMINER'],
  },
  {
    href: '/admin/bookings',
    label: 'رزروها',
    labelEn: 'Bookings',
    icon: CalendarDays,
    roles: ['ADMIN', 'STAFF'],
    permission: 'bookings.read',
  },
  {
    href: '/admin/availability-blocks',
    label: 'مسدودی‌های زمان',
    labelEn: 'Availability blocks',
    icon: CalendarDays,
    roles: ['ADMIN', 'STAFF'],
    permission: 'availability.manage',
  },
  {
    href: '/admin/tickets',
    label: 'تیکت‌ها',
    labelEn: 'Tickets',
    icon: TicketCheck,
    roles: ['ADMIN', 'STAFF', 'SUPPORT'],
    permission: 'tickets.read',
  },
  {
    href: '/admin/finance',
    label: 'امور مالی',
    labelEn: 'Finance',
    icon: CreditCard,
    roles: ['ADMIN', 'STAFF'],
    permission: 'payments.read',
  },
  {
    href: '/admin/discounts',
    label: 'کدهای تخفیف',
    labelEn: 'Discounts',
    roles: ['ADMIN', 'FINANCE'],
    permission: 'payouts.manage',
  },
  {
    href: '/admin/refunds',
    label: 'بازپرداخت‌ها',
    labelEn: 'Refunds',
    roles: ['ADMIN', 'FINANCE'],
    permission: 'payments.refund',
  },
  {
    href: '/admin/teacher-earnings',
    label: 'درآمد مدرس‌ها',
    labelEn: 'Teacher earnings',
    roles: ['ADMIN', 'STAFF'],
    permission: 'reports.read',
  },
  {
    href: '/admin/payouts',
    label: 'تسویه‌ها',
    labelEn: 'Payouts',
    roles: ['ADMIN', 'FINANCE'],
    permission: 'payouts.manage',
  },
  {
    href: '/admin/reviews',
    label: 'نظرات',
    labelEn: 'Reviews',
    roles: ['ADMIN', 'STAFF'],
    permission: 'reviews.manage',
  },
  {
    href: '/admin/roles',
    label: 'نقش‌ها و مجوزها',
    labelEn: 'Roles & permissions',
    icon: ShieldCheck,
    roles: ['ADMIN', 'STAFF'],
    permission: 'roles.manage',
  },
  { href: '/admin/cms', label: 'مدیریت محتوا', labelEn: 'CMS', roles: ['ADMIN', 'STAFF'], permission: 'cms.manage' },
  {
    href: '/admin/notifications',
    label: 'اعلان‌ها',
    labelEn: 'Notifications',
    icon: Bell,
    roles: ['ADMIN', 'STAFF'],
    permission: 'notifications.read',
  },
  {
    href: '/admin/audit',
    label: 'لاگ فعالیت',
    labelEn: 'Audit logs',
    roles: ['ADMIN', 'STAFF'],
    permission: 'audit.read',
  },
  {
    href: '/admin/settings',
    label: 'تنظیمات',
    labelEn: 'Settings',
    icon: Settings,
    roles: ['ADMIN', 'STAFF'],
    permission: 'settings.manage',
  },
];
