import { PanelActions } from '@/components/panel-actions';
import { PanelShell, adminNav } from '@/components/panel-shell';
import { ResourceView } from '@/components/resource-view';
import { AdminTestManager } from '@/components/admin-test-manager';
import { AdminUsersManager } from '@/components/admin-users-manager';
import { ExaminerReviewManager } from '@/components/examiner-review-manager';
import { TicketManager } from '@/components/ticket-manager';
import { LanguageManager } from '@/components/language-manager';
import { PricingManager } from '@/components/pricing-manager';
import {requestLocale} from '@/lib/server-locale';

const map: Record<string, [string, string, string]> = {
  users: ['کاربران','Users', '/admin/users'],
  teachers: ['مدرس‌ها','Teachers', '/admin/teacher-applications'],
  'teacher-applications': ['درخواست‌های مدرس','Teacher applications', '/admin/teacher-applications'],
  'teacher-documents': ['مدارک مدرس','Teacher documents', '/admin/teacher-applications'],
  tests: ['آزمون‌ها','Tests', '/admin/tests'],
  bookings: ['رزروها','Bookings', '/admin/bookings'],
  'availability-blocks': ['مسدودی‌های زمان','Availability blocks', '/admin/bookings'],
  finance: ['امور مالی','Finance', '/admin/payments'],
  payments: ['پرداخت‌ها و بازپرداخت','Payments and refunds', '/admin/payments'],
  discounts: ['کدهای تخفیف','Discounts', '/admin/payments'],
  refunds: ['بازپرداخت‌ها','Refunds', '/admin/payments'],
  'teacher-earnings': ['درآمد مدرس‌ها','Teacher earnings', '/admin/reports'],
  payouts: ['تسویه‌ها','Payouts', '/admin/reports'],
  reviews: ['نظرات مدرس‌ها','Teacher reviews', '/admin/reviews'],
  notifications: ['لاگ ارسال پیامک و اعلان','Notification deliveries', '/admin/notification-deliveries'],
  roles: ['نقش‌ها و مجوزها','Roles and permissions', '/admin/roles'],
  reports: ['گزارش‌های مدیریتی','Management reports', '/admin/reports'],
  audit: ['گزارش فعالیت','Audit log', '/admin/audit-logs'],
  cms: ['مدیریت محتوا','CMS', '/admin/cms'],
  settings: ['تنظیمات','Settings', '/admin/settings'],
  search: ['جستجوی سراسری','Global search', '/admin/dashboard'],
};

export default async function Section({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const locale=await requestLocale(),fa=locale==='fa';
  const [titleFa,titleEn, endpoint] = map[section] ?? ['مدیریت','Administration', '/admin/dashboard'];
  let content:React.ReactNode;
  if(section==='tests')content=<AdminTestManager/>;
  else if(section==='users')content=<><PanelActions role="admin" section={section} endpoint={endpoint}/><AdminUsersManager/></>;
  else if(section==='test-reviews')content=<ExaminerReviewManager/>;
  else if(section==='tickets')content=<TicketManager/>;
  else if(section==='languages')content=<LanguageManager/>;
  else if(section==='teacher-prices')content=<PricingManager mode="admin"/>;
  else content=<><PanelActions role="admin" section={section} endpoint={endpoint}/><ResourceView title={fa?titleFa:titleEn} endpoint={endpoint}/></>;
  return <PanelShell title="مدیریت لینگواسپیک" items={adminNav}>{content}</PanelShell>;
}
