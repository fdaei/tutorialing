import { localized, isDefaultLocale } from '@/lib/i18n';
import { PanelActions, PanelShell, ResourceView, adminNav } from '@/features/panel';
import {
  AdminFinanceCenter,
  AdminTestManager,
  AdminUsersManager,
  CountryManager,
  ExaminerReviewManager,
  LanguageManager,
} from '@/features/admin';
import { TicketManager } from '@/features/support';
import { PricingManager } from '@/features/commerce';
import { requestLocale } from '@/lib/server-locale';
import { TeacherPlannerCalendar } from '@/features/scheduling';
import { FeatureErrorBoundary } from '@/shared/components/error-boundaries';

const map: Record<string, [string, string, string]> = {
  users: ['کاربران', 'Users', '/admin/users'],
  teachers: ['مدرس‌ها', 'Teachers', '/admin/teacher-applications'],
  'teacher-applications': ['درخواست‌های مدرس', 'Teacher applications', '/admin/teacher-applications'],
  'teacher-documents': ['مدارک مدرس', 'Teacher documents', '/admin/teacher-applications'],
  tests: ['آزمون‌ها', 'Tests', '/admin/tests'],
  bookings: ['رزروها', 'Bookings', '/admin/bookings'],
  'availability-blocks': ['مسدودی‌های زمان', 'Availability blocks', '/admin/bookings'],
  finance: ['امور مالی', 'Finance', '/admin/payments'],
  payments: ['پرداخت‌ها و بازپرداخت', 'Payments and refunds', '/admin/payments'],
  discounts: ['کدهای تخفیف', 'Discounts', '/admin/payments'],
  refunds: ['بازپرداخت‌ها', 'Refunds', '/admin/payments'],
  'teacher-earnings': ['درآمد مدرس‌ها', 'Teacher earnings', '/admin/reports'],
  payouts: ['تسویه‌ها', 'Payouts', '/admin/reports'],
  reviews: ['نظرات مدرس‌ها', 'Teacher reviews', '/admin/reviews'],
  notifications: ['لاگ ارسال پیامک و اعلان', 'Notification deliveries', '/admin/notification-deliveries'],
  roles: ['نقش‌ها و مجوزها', 'Roles and permissions', '/admin/roles'],
  reports: ['گزارش‌های مدیریتی', 'Management reports', '/admin/reports'],
  audit: ['گزارش فعالیت', 'Audit log', '/admin/audit-logs'],
  cms: ['مدیریت محتوا', 'CMS', '/admin/cms'],
  settings: ['تنظیمات', 'Settings', '/admin/settings'],
  countries: ['کشورها و پیش‌شماره‌ها', 'Countries and calling codes', '/admin/countries'],
  search: ['جستجوی سراسری', 'Global search', '/admin/dashboard'],
};

export default async function Section({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const locale = await requestLocale(),
    fa = isDefaultLocale(locale);
  const [titleFa, titleEn, endpoint] = map[section] ?? ['مدیریت', 'Administration', '/admin/dashboard'];
  let content: React.ReactNode;
  if (section === 'tests') content = <AdminTestManager />;
  else if (section === 'bookings')
    content = (
      <div className="grid gap-6">
        <TeacherPlannerCalendar mode="admin" />
        <PanelActions role="admin" section={section} endpoint={endpoint} />
        <ResourceView title={localized({ fa: titleFa, en: titleEn }, locale)} endpoint={endpoint} />
      </div>
    );
  else if (section === 'users')
    content = (
      <>
        <PanelActions role="admin" section={section} endpoint={endpoint} />
        <AdminUsersManager />
      </>
    );
  else if (section === 'test-reviews') content = <ExaminerReviewManager />;
  else if (section === 'tickets') content = <TicketManager />;
  else if (section === 'languages') content = <LanguageManager />;
  else if (section === 'countries') content = <CountryManager />;
  else if (section === 'teacher-prices') content = <PricingManager mode="admin" />;
  else if (section === 'finance' || section === 'payouts') content = <AdminFinanceCenter />;
  else
    content = (
      <>
        <PanelActions role="admin" section={section} endpoint={endpoint} />
        <ResourceView title={localized({ fa: titleFa, en: titleEn }, locale)} endpoint={endpoint} />
      </>
    );
  return (
    <PanelShell title="مدیریت لینگواسپیک" items={adminNav}>
      <FeatureErrorBoundary name={`admin-${section}`}>{content}</FeatureErrorBoundary>
    </PanelShell>
  );
}
