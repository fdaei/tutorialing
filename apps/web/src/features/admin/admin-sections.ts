export const adminSectionConfig = {
  users: ['کاربران', 'Users', '/admin/users'],
  teachers: ['مدرس‌ها', 'Teachers', '/admin/teacher-applications'],
  'teacher-applications': ['درخواست‌های مدرس', 'Teacher applications', '/admin/teacher-applications'],
  'teacher-documents': ['مدارک مدرس', 'Teacher documents', '/admin/teacher-applications'],
  'teacher-prices': ['تأیید قیمت مدرس', 'Teacher price approvals', '/admin/teacher-prices'],
  languages: ['زبان‌ها', 'Languages', '/admin/languages'],
  countries: ['کشورها و پیش‌شماره‌ها', 'Countries and calling codes', '/admin/countries'],
  tests: ['آزمون‌ها', 'Tests', '/admin/tests'],
  'test-reviews': ['تصحیح آزمون', 'Test reviews', '/examiner/tests/queue'],
  bookings: ['رزروها', 'Bookings', '/admin/bookings'],
  'availability-blocks': ['مسدودی‌های زمان', 'Availability blocks', '/admin/bookings'],
  tickets: ['تیکت‌ها', 'Tickets', '/admin/tickets'],
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
  magazine: ['بررسی مجله', 'Magazine review', '/blog/review/queue'],
  settings: ['تنظیمات', 'Settings', '/admin/settings'],
  search: ['جستجوی سراسری', 'Global search', '/admin/dashboard'],
} as const satisfies Record<string, readonly [titleFa: string, titleEn: string, endpoint: string]>;

export type AdminSection = keyof typeof adminSectionConfig;

export function isAdminSection(value: string): value is AdminSection {
  return Object.prototype.hasOwnProperty.call(adminSectionConfig, value);
}
