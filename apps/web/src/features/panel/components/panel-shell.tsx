'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '@/shared/services/api';
import {
  Bell,
  BookOpen,
  CalendarClock,
  CalendarDays,
  ChevronDown,
  CreditCard,
  FileCheck,
  FileEdit,
  Flag,
  Globe2,
  GraduationCap,
  Grid2X2,
  HelpCircle,
  Home,
  LifeBuoy,
  LogOut,
  Map,
  Menu,
  MessageSquareQuote,
  MoreHorizontal,
  PanelsTopLeft,
  Percent,
  ReceiptText,
  RotateCcw,
  ScrollText,
  Search,
  Settings,
  ShieldCheck,
  TicketCheck,
  UserCog,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { LanguageSwitcher } from '@/components/shared/language-switcher';
import { useTranslations } from '@/components/shared/locale-provider';
import { authPath, localePath, localized, translate } from '@/lib/i18n';
import type { AdminDashboard } from '@lingospeak/contracts';
import { clearAuthSession } from '@/shared/services/api';
import { featureFlags } from '@/config';
import { cn } from '@/shared/components/ui/cn';
import { formatNumber } from '@/lib/money';
import { useNotifications } from '../hooks/use-notifications';

export type NavItem = {
  href: string;
  label: string;
  labelEn: string;
  icon?: React.ElementType;
  roles?: string[];
  permission?: string;
  /** Pinned to the phone bottom tab bar (student/teacher panels, max 4). */
  tab?: boolean;
};

export const adminNavigationGroups = [
  { id: 'overview', label: 'نمای کلی', labelEn: 'Overview', icon: Grid2X2, hrefs: ['/admin'] },
  {
    id: 'users',
    label: 'کاربران',
    labelEn: 'Users',
    icon: Users,
    hrefs: [
      '/admin/users',
      '/admin/teachers',
      '/admin/teacher-applications',
      '/admin/teacher-documents',
      '/admin/teacher-prices',
    ],
  },
  {
    id: 'learning',
    label: 'آموزش',
    labelEn: 'Learning',
    icon: BookOpen,
    hrefs: [
      '/admin/languages',
      '/admin/countries',
      '/admin/courses',
      '/admin/tests',
      '/admin/test-reviews',
      '/admin/bookings',
      '/admin/availability-blocks',
    ],
  },
  {
    id: 'content',
    label: 'محتوا',
    labelEn: 'Content',
    icon: FileEdit,
    hrefs: ['/admin/magazine', '/admin/cms', '/admin/website-builder', '/admin/reviews'],
  },
  {
    id: 'operations',
    label: 'عملیات',
    labelEn: 'Operations',
    icon: LifeBuoy,
    hrefs: [
      '/admin/tickets',
      '/admin/finance',
      '/admin/discounts',
      '/admin/refunds',
      '/admin/teacher-earnings',
      '/admin/payouts',
      '/admin/notifications',
    ],
  },
  {
    id: 'system',
    label: 'سیستم',
    labelEn: 'System',
    icon: Settings,
    hrefs: ['/admin/roles', '/admin/audit', '/admin/settings'],
  },
] as const;

const roleLabels: Record<string, { fa: string; en: string }> = {
  ADMIN: { fa: 'مدیر کل', en: 'Administrator' },
  SUPPORT: { fa: 'پشتیبان', en: 'Support' },
  INSTRUCTOR: { fa: 'مدرس', en: 'Instructor' },
  STUDENT: { fa: 'زبان‌آموز', en: 'Student' },
};

export function PanelShell({ items, children }: { title?: string; items: NavItem[]; children: React.ReactNode }) {
  const router = useRouter(),
    path = usePathname(),
    [open, setOpen] = useState(false),
    { locale } = useTranslations(),
    english = locale === 'en',
    p = (href: string) => localePath(href, locale);
  const me = useQuery({
    queryKey: ['panel-me'],
    queryFn: () =>
      api<{ name?: string; avatarUrl?: string | null; roles: string[]; permissions: string[] }>('/users/me'),
    retry: false,
  });
  useEffect(() => {
    if (me.error instanceof ApiError && me.error.status === 401) router.replace(authPath(location.pathname, locale));
  }, [locale, me.error, router]);
  useEffect(() => setOpen(false), [path]);
  const adminMode = path.includes('/admin'),
    teacherMode = path.includes('/teacher-panel'),
    allowed = adminMode ? ['ADMIN', 'SUPPORT'] : teacherMode ? ['INSTRUCTOR', 'ADMIN'] : [];
  const roles = Array.isArray(me.data?.roles) ? me.data.roles : [];
  const permissions = Array.isArray(me.data?.permissions) ? me.data.permissions : [];
  const isAdmin = roles.includes('ADMIN');
  const notifications = useNotifications(Boolean(me.data) && !adminMode);
  const adminSummary = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => api<AdminDashboard>('/admin/dashboard'),
    enabled: adminMode && isAdmin,
  });
  const canSee = (item: NavItem) =>
    (!item.roles || item.roles.some((role) => roles.includes(role))) &&
    (!item.permission || permissions.includes(item.permission));
  const visibleItems = items.filter(canSee);
  const homeHrefs = ['/admin', '/dashboard', '/teacher-panel'];
  const matches = (href: string) => {
    const localizedHref = p(href);
    return path === localizedHref || (!homeHrefs.includes(href) && path.startsWith(`${localizedHref}/`));
  };
  const currentItem = [...items].sort((a, b) => b.href.length - a.href.length).find((item) => matches(item.href));

  // Never render account navigation or page content until authentication has
  // been confirmed. In particular, a 401 used to trigger the redirect above
  // while briefly exposing the panel shell and its children.
  if (me.isLoading || !me.data)
    return (
      <div className="flex min-h-screen bg-canvas" role="status" aria-label={english ? 'Loading' : 'در حال بارگذاری'}>
        <div className="hidden w-[256px] border-e border-line bg-white lg:block" />
        <div className="flex-1 p-6">
          <div className="skeleton mb-6 h-10 w-56 rounded-xl" />
          <div className="grid gap-4 md:grid-cols-3">
            <div className="skeleton h-28 rounded-2xl" />
            <div className="skeleton h-28 rounded-2xl" />
            <div className="skeleton h-28 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  if ((allowed.length && !roles.some((r) => allowed.includes(r))) || (currentItem && !canSee(currentItem)))
    return (
      <main className="grid min-h-screen place-items-center bg-canvas p-4">
        <div className="panel-card max-w-sm p-8 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-danger-soft text-danger">
            <ShieldCheck />
          </span>
          <h1 className="mt-4 text-xl font-black">{translate(locale, 'panelpanelShellAccessDenied')}</h1>
          <Link href={p('/panel')} className="primary-button mt-5">
            {translate(locale, 'panelpanelShellOpenMyWorkspace')}
          </Link>
        </div>
      </main>
    );

  const primaryRole = isAdmin ? 'ADMIN' : roles.includes('SUPPORT') ? 'SUPPORT' : roles.includes('INSTRUCTOR') ? 'INSTRUCTOR' : 'STUDENT';
  const supportTitle = permissions.includes('tests.review')
    ? translate(locale, 'panelpanelShellExaminerWorkspace')
    : permissions.some((permission) => ['payouts.manage', 'payments.refund', 'teacher-prices.manage'].includes(permission))
      ? translate(locale, 'panelpanelShellFinanceWorkspace')
      : translate(locale, 'panelpanelShellSupportWorkspace');
  const displayTitle = adminMode
    ? primaryRole === 'SUPPORT'
      ? supportTitle
      : translate(locale, 'panelpanelShellLingospeakAdministration')
    : teacherMode
      ? translate(locale, 'panelpanelShellTeacherPanel')
      : translate(locale, 'panelpanelShellStudentDashboard');
  const base = adminMode ? '/admin' : teacherMode ? '/teacher-panel' : '/dashboard';
  const helpHref = adminMode ? null : `${base}/tickets`;
  const notificationsHref = adminMode ? null : `${base}/notifications`;
  const adminGroups = adminNavigationGroups
    .map((group) => ({
      ...group,
      items: group.hrefs.map((href) => visibleItems.find((item) => item.href === href)).filter(Boolean) as NavItem[],
    }))
    .filter((group) => group.items.length);
  const badgeFor = (href: string) =>
    href === '/admin/teacher-applications'
      ? adminSummary.data?.pendingTeachers
      : href === '/admin/tickets'
        ? adminSummary.data?.openTickets
        : href === '/admin/test-reviews'
          ? adminSummary.data?.pendingReviews
          : undefined;
  const label = (item: NavItem) => localized({ fa: item.label, en: item.labelEn }, locale);
  const tabItems = adminMode ? [] : visibleItems.filter((item) => item.tab).slice(0, 4);
  const signOut = async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    clearAuthSession();
    router.replace(p('/'));
  };

  const Sidebar = () => (
    <aside className={cn('flex h-full flex-col p-3', adminMode ? 'admin-sidebar text-white' : 'bg-white text-ink')}>
      <Link href={p('/')} className="flex items-center gap-3 rounded-xl px-2 py-2">
        <span className={cn('grid size-10 place-items-center rounded-xl text-white', adminMode ? 'bg-primary' : 'bg-brand')}>
          <GraduationCap size={21} aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <strong className="latin block text-lg leading-6">LingoSpeak</strong>
          <small className={cn('block truncate text-xs', adminMode ? 'text-white/55' : 'text-muted')}>{displayTitle}</small>
        </span>
      </Link>
      {adminMode ? (
        <nav className="admin-nav-groups mt-5 min-h-0 flex-1 overflow-y-auto" aria-label={english ? 'Admin navigation' : 'ناوبری مدیریت'}>
          {adminGroups.map((group) => {
            const GroupIcon = group.icon;
            const active = group.items.some((item) => matches(item.href));
            if (group.items.length === 1) {
              const item = group.items[0]!;
              return (
                <Link key={group.id} href={p(item.href)} aria-current={active ? 'page' : undefined} className={cn('admin-nav-item', active && 'admin-nav-active')}>
                  <GroupIcon size={17} aria-hidden="true" />
                  <span className="flex-1">{label(item)}</span>
                </Link>
              );
            }
            return (
              <details key={group.id} className="admin-nav-group" open={active || undefined}>
                <summary>
                  <GroupIcon size={17} aria-hidden="true" />
                  <span>{localized({ fa: group.label, en: group.labelEn }, locale)}</span>
                  <ChevronDown className="admin-group-chevron" size={15} aria-hidden="true" />
                </summary>
                <div className="admin-nav-children">
                  {group.items.map((item) => {
                    const Icon = item.icon ?? Home;
                    const itemActive = matches(item.href);
                    const badge = badgeFor(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={p(item.href)}
                        aria-current={itemActive ? 'page' : undefined}
                        className={cn('admin-nav-item', itemActive && 'admin-nav-active')}
                      >
                        <Icon size={16} aria-hidden="true" />
                        <span className="flex-1">{label(item)}</span>
                        {Boolean(badge) && <span className="admin-nav-badge">{formatNumber(Number(badge), locale)}</span>}
                      </Link>
                    );
                  })}
                </div>
              </details>
            );
          })}
        </nav>
      ) : (
        <nav className="mt-5 grid min-h-0 flex-1 content-start gap-0.5 overflow-y-auto" aria-label={english ? 'Panel navigation' : 'ناوبری پنل'}>
          {visibleItems.map((item) => {
            const Icon = item.icon ?? Home;
            const active = matches(item.href);
            return (
              <Link
                key={item.href}
                href={p(item.href)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-bold transition',
                  active ? 'bg-primary-soft text-primary' : 'text-muted hover:bg-canvas hover:text-ink',
                )}
              >
                <Icon size={18} aria-hidden="true" />
                <span className="flex-1">{label(item)}</span>
              </Link>
            );
          })}
        </nav>
      )}
      {(roles.includes('INSTRUCTOR') || isAdmin) && (
        <div className={cn('mt-3 rounded-xl p-2', adminMode ? 'bg-white/[.06]' : 'bg-canvas')}>
          <small className={cn('mb-1 block px-2 text-[11px] font-bold', adminMode ? 'text-white/50' : 'text-muted')}>
            {translate(locale, 'panelpanelShellSwitchWorkspace')}
          </small>
          {[
            { href: '/dashboard', icon: Home, text: translate(locale, 'panelpanelShellUserDashboard'), show: true },
            { href: '/teacher-panel', icon: BookOpen, text: translate(locale, 'panelpanelShellTeacherPanel'), show: roles.includes('INSTRUCTOR') },
            { href: '/admin', icon: ShieldCheck, text: translate(locale, 'panelpanelShellAdminPanel'), show: isAdmin },
          ]
            .filter((entry) => entry.show && entry.href !== base)
            .map(({ href, icon: Icon, text }) => (
              <Link key={href} href={p(href)} className={cn('flex min-h-9 items-center gap-2 rounded-lg px-2 text-xs font-bold', adminMode ? 'hover:bg-white/10' : 'hover:bg-white')}>
                <Icon size={15} aria-hidden="true" /> {text}
              </Link>
            ))}
        </div>
      )}
      <div className={cn('mt-2 flex items-center gap-3 rounded-xl p-2', adminMode ? 'bg-white/[.06]' : 'bg-canvas')}>
        <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-brand font-black text-white">
          {me.data?.avatarUrl ? <img src={me.data.avatarUrl} alt="" className="size-full object-cover" /> : (me.data?.name ?? 'L').slice(0, 1)}
        </span>
        <span className="min-w-0 flex-1">
          <strong className="block truncate text-xs">{me.data?.name || roleLabels[primaryRole]![locale]}</strong>
          <small className={cn('block text-[11px]', adminMode ? 'text-white/55' : 'text-muted')}>{roleLabels[primaryRole]![locale]}</small>
        </span>
        <button
          type="button"
          onClick={signOut}
          aria-label={translate(locale, 'panelpanelShellSignOut')}
          title={translate(locale, 'panelpanelShellSignOut')}
          className={cn('grid size-9 place-items-center rounded-lg', adminMode ? 'text-white/60 hover:bg-white/10 hover:text-white' : 'text-muted hover:bg-white hover:text-danger')}
        >
          <LogOut size={17} className="rtl:rotate-180" />
        </button>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-canvas">
      <div className={cn('fixed inset-y-0 start-0 z-30 hidden w-[256px] border-e lg:block', adminMode ? 'border-transparent' : 'border-line')}>
        <Sidebar />
      </div>
      {open && (
        <div className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-sm lg:hidden" onClick={() => setOpen(false)}>
          <div className="relative h-full w-[288px] max-w-[85vw] shadow-pop" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="absolute end-3 top-3 z-10 grid size-9 place-items-center rounded-full bg-white text-ink shadow"
              onClick={() => setOpen(false)}
              aria-label={translate(locale, 'adminadminUsersManagerClose')}
            >
              <X size={18} />
            </button>
            <Sidebar />
          </div>
        </div>
      )}
      <main className={cn('min-w-0 lg:ms-[256px]', tabItems.length > 0 && 'pb-tabbar')}>
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-white/90 px-4 backdrop-blur-xl md:px-6">
          <button
            type="button"
            className="grid size-10 place-items-center rounded-xl text-ink hover:bg-canvas lg:hidden"
            onClick={() => setOpen(true)}
            aria-label={translate(locale, 'panelpanelShellMenu')}
          >
            <Menu size={21} />
          </button>
          <p className="min-w-0 truncate text-sm font-bold text-ink lg:hidden">{currentItem ? label(currentItem) : displayTitle}</p>
          {adminMode && isAdmin && permissions.includes('users.read') && <AdminQuickSearch />}
          <div className="ms-auto flex items-center gap-1.5">
            <LanguageSwitcher className="hidden rounded-xl border border-line px-2 py-1.5 sm:inline-flex" />
            {helpHref && (
              <Link
                href={p(helpHref)}
                className="hidden size-10 place-items-center rounded-xl text-muted hover:bg-canvas hover:text-ink sm:grid"
                aria-label={english ? 'Help and support' : 'راهنما و پشتیبانی'}
                title={english ? 'Help and support' : 'راهنما و پشتیبانی'}
              >
                <HelpCircle size={19} />
              </Link>
            )}
            {notificationsHref && (
              <Link
                href={p(notificationsHref)}
                className="relative grid size-10 place-items-center rounded-xl text-muted hover:bg-canvas hover:text-ink"
                aria-label={
                  notifications.unread
                    ? english
                      ? `Notifications, ${notifications.unread} unread`
                      : `اعلان‌ها، ${formatNumber(notifications.unread, locale)} خوانده‌نشده`
                    : translate(locale, 'teacherteacherMoreNotifications')
                }
              >
                <Bell size={19} />
                {notifications.unread > 0 && (
                  <span className="absolute end-1 top-1 grid min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold leading-4 text-white ring-2 ring-white">
                    {notifications.unread > 9 ? '9+' : formatNumber(notifications.unread, locale)}
                  </span>
                )}
              </Link>
            )}
          </div>
        </header>
        <div className={cn('mx-auto p-4 sm:p-6 lg:p-8', adminMode ? 'max-w-[1320px]' : 'max-w-[1240px]')}>
          <div className="reveal">{children}</div>
        </div>
      </main>
      {tabItems.length > 0 && (
        <nav
          aria-label={english ? 'Quick navigation' : 'دسترسی سریع'}
          className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
        >
          {tabItems.map((item) => {
            const Icon = item.icon ?? Home;
            const active = matches(item.href);
            return (
              <Link
                key={item.href}
                href={p(item.href)}
                aria-current={active ? 'page' : undefined}
                className={cn('flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-bold', active ? 'text-primary' : 'text-muted')}
              >
                <Icon size={21} aria-hidden="true" />
                <span className="max-w-full truncate px-1">{label(item)}</span>
              </Link>
            );
          })}
          <button type="button" onClick={() => setOpen(true)} className="flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-bold text-muted">
            <MoreHorizontal size={21} aria-hidden="true" />
            {english ? 'More' : 'بیشتر'}
          </button>
        </nav>
      )}
    </div>
  );
}

/** Real admin search: jumps to the users list filtered by name, phone or email. */
function AdminQuickSearch() {
  const router = useRouter();
  const { locale } = useTranslations();
  const [value, setValue] = useState('');
  const english = locale === 'en';
  return (
    <form
      role="search"
      className="relative hidden w-full max-w-sm md:block"
      onSubmit={(event) => {
        event.preventDefault();
        const term = value.trim();
        router.push(localePath(term ? `/admin/users?q=${encodeURIComponent(term)}` : '/admin/users', locale));
      }}
    >
      <Search size={17} aria-hidden="true" className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-subtle" />
      <input
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        aria-label={english ? 'Search users by name, phone or email' : 'جست‌وجوی کاربر با نام، موبایل یا ایمیل'}
        placeholder={english ? 'Search users by name, phone or email…' : 'جست‌وجوی کاربر با نام، موبایل یا ایمیل…'}
        className="input min-h-10 bg-canvas ps-9"
      />
    </form>
  );
}

export const studentNav: NavItem[] = [
  { href: '/dashboard', label: 'خانه', labelEn: 'Home', icon: Grid2X2, tab: true },
  { href: '/dashboard/courses', label: 'دوره‌های من', labelEn: 'My courses', icon: BookOpen, tab: true },
  { href: '/dashboard/classes', label: 'کلاس‌ها', labelEn: 'Classes', icon: CalendarDays, tab: true },
  { href: '/dashboard/tests', label: 'آزمون‌ها و نتایج', labelEn: 'Tests & results', icon: FileCheck, tab: true },
  { href: '/dashboard/plan', label: 'برنامه یادگیری', labelEn: 'Learning plan', icon: Map },
  // Match history stays reachable at /dashboard/matches; only the menu entry follows the flag.
  ...(featureFlags.teacherDiscovery
    ? [{ href: '/dashboard/matches', label: 'مدرس‌های پیشنهادی', labelEn: 'Matched teachers', icon: Users }]
    : []),
  { href: '/dashboard/notifications', label: 'اعلان‌ها', labelEn: 'Notifications', icon: Bell },
  { href: '/dashboard/wallet', label: 'پرداخت‌ها', labelEn: 'Payments', icon: Wallet },
  { href: '/dashboard/tickets', label: 'پشتیبانی', labelEn: 'Support', icon: LifeBuoy },
  { href: '/dashboard/profile', label: 'پروفایل و تنظیمات', labelEn: 'Profile & settings', icon: Settings },
];
export const teacherNav: NavItem[] = [
  { href: '/teacher-panel', label: 'خانه', labelEn: 'Home', icon: Grid2X2, tab: true },
  { href: '/teacher-panel/classes', label: 'کلاس‌ها', labelEn: 'Classes', icon: CalendarDays, tab: true },
  { href: '/teacher-panel/availability', label: 'برنامه کاری', labelEn: 'Schedule', icon: CalendarClock },
  { href: '/teacher-panel/students', label: 'زبان‌آموزان', labelEn: 'Students', icon: Users, tab: true },
  { href: '/teacher-panel/courses', label: 'دوره‌های من', labelEn: 'My courses', icon: BookOpen },
  { href: '/teacher-panel/profile', label: 'پروفایل و تأیید', labelEn: 'Profile & verification', icon: UserCog },
  { href: '/teacher-panel/magazine', label: 'مجله', labelEn: 'Magazine', icon: FileEdit },
  { href: '/teacher-panel/earnings', label: 'مالی', labelEn: 'Finance', icon: Wallet, tab: true },
  { href: '/teacher-panel/more', label: 'بیشتر', labelEn: 'More', icon: MoreHorizontal },
];
export const adminNav: NavItem[] = [
  { href: '/admin', label: 'داشبورد', labelEn: 'Dashboard', icon: Grid2X2, roles: ['ADMIN'] },
  { href: '/admin/magazine', label: 'بررسی مجله', labelEn: 'Magazine review', icon: FileEdit, roles: ['ADMIN'], permission: 'cms.manage' },
  { href: '/admin/users', label: 'کاربران', labelEn: 'Users', icon: Users, roles: ['ADMIN'], permission: 'users.read' },
  { href: '/admin/teachers', label: 'مدرس‌ها', labelEn: 'Teachers', icon: GraduationCap, roles: ['ADMIN'], permission: 'teachers.verify' },
  { href: '/admin/teacher-applications', label: 'درخواست‌های مدرس', labelEn: 'Teacher applications', icon: FileCheck, roles: ['ADMIN'], permission: 'teachers.verify' },
  { href: '/admin/teacher-documents', label: 'مدارک مدرس', labelEn: 'Teacher documents', icon: ScrollText, roles: ['ADMIN'], permission: 'teachers.verify' },
  { href: '/admin/teacher-prices', label: 'تأیید قیمت مدرس', labelEn: 'Teacher price approvals', icon: CreditCard, roles: ['ADMIN', 'SUPPORT'], permission: 'teacher-prices.manage' },
  { href: '/admin/languages', label: 'زبان‌ها', labelEn: 'Languages', icon: Globe2, roles: ['ADMIN'], permission: 'languages.manage' },
  { href: '/admin/courses', label: 'دوره‌ها', labelEn: 'Courses', icon: BookOpen, roles: ['ADMIN'], permission: 'courses.manage' },
  { href: '/admin/countries', label: 'کشورها', labelEn: 'Countries', icon: Flag, roles: ['ADMIN'], permission: 'languages.manage' },
  { href: '/admin/tests', label: 'آزمون‌ها', labelEn: 'Tests', icon: FileCheck, roles: ['ADMIN'], permission: 'tests.manage' },
  { href: '/admin/test-reviews', label: 'تصحیح آزمون', labelEn: 'Test reviews', icon: FileEdit, roles: ['ADMIN', 'SUPPORT'], permission: 'tests.review' },
  { href: '/admin/bookings', label: 'رزروها', labelEn: 'Bookings', icon: CalendarDays, roles: ['ADMIN'], permission: 'bookings.read' },
  { href: '/admin/availability-blocks', label: 'مسدودی‌های زمان', labelEn: 'Availability blocks', icon: CalendarClock, roles: ['ADMIN'], permission: 'availability.manage' },
  { href: '/admin/tickets', label: 'تیکت‌ها', labelEn: 'Tickets', icon: TicketCheck, roles: ['ADMIN', 'SUPPORT'], permission: 'tickets.read' },
  { href: '/admin/finance', label: 'امور مالی', labelEn: 'Finance', icon: CreditCard, roles: ['ADMIN'], permission: 'payments.read' },
  { href: '/admin/discounts', label: 'کدهای تخفیف', labelEn: 'Discounts', icon: Percent, roles: ['ADMIN', 'SUPPORT'], permission: 'payouts.manage' },
  { href: '/admin/refunds', label: 'بازپرداخت‌ها', labelEn: 'Refunds', icon: RotateCcw, roles: ['ADMIN', 'SUPPORT'], permission: 'payments.refund' },
  { href: '/admin/teacher-earnings', label: 'درآمد مدرس‌ها', labelEn: 'Teacher earnings', icon: Wallet, roles: ['ADMIN'], permission: 'reports.read' },
  { href: '/admin/payouts', label: 'تسویه‌ها', labelEn: 'Payouts', icon: ReceiptText, roles: ['ADMIN', 'SUPPORT'], permission: 'payouts.manage' },
  { href: '/admin/reviews', label: 'نظرات', labelEn: 'Reviews', icon: MessageSquareQuote, roles: ['ADMIN'], permission: 'reviews.manage' },
  { href: '/admin/roles', label: 'نقش‌ها و مجوزها', labelEn: 'Roles & permissions', icon: ShieldCheck, roles: ['ADMIN'], permission: 'roles.manage' },
  { href: '/admin/cms', label: 'مدیریت محتوا', labelEn: 'CMS', icon: FileEdit, roles: ['ADMIN'], permission: 'cms.manage' },
  { href: '/admin/website-builder', label: 'سازنده سایت', labelEn: 'Website builder', icon: PanelsTopLeft, roles: ['ADMIN'], permission: 'settings.manage' },
  { href: '/admin/notifications', label: 'لاگ اعلان‌ها', labelEn: 'Notification log', icon: Bell, roles: ['ADMIN'], permission: 'notifications.read' },
  { href: '/admin/audit', label: 'لاگ فعالیت', labelEn: 'Audit log', icon: ScrollText, roles: ['ADMIN'], permission: 'audit.read' },
  { href: '/admin/settings', label: 'تنظیمات', labelEn: 'Settings', icon: Settings, roles: ['ADMIN'], permission: 'settings.manage' },
];
