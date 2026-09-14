import type { Locale } from './i18n';

export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'accent';

/**
 * The one place a backend enum becomes user-facing text and a colour.
 * Components used to hand-roll partial maps (and some rendered raw values like
 * `UNDER_REVIEW` or `urgent`); anything not listed here is humanised rather than
 * shown verbatim.
 */
const STATUS: Record<string, { fa: string; en: string; tone: StatusTone }> = {
  ACTIVE: { fa: 'فعال', en: 'Active', tone: 'success' },
  INACTIVE: { fa: 'غیرفعال', en: 'Inactive', tone: 'neutral' },
  SUSPENDED: { fa: 'تعلیق‌شده', en: 'Suspended', tone: 'danger' },
  DELETED: { fa: 'حذف‌شده', en: 'Deleted', tone: 'neutral' },
  PENDING: { fa: 'در انتظار', en: 'Pending', tone: 'warning' },
  PENDING_PAYMENT: { fa: 'در انتظار پرداخت', en: 'Pending payment', tone: 'warning' },
  PAID: { fa: 'پرداخت‌شده', en: 'Paid', tone: 'success' },
  SUCCEEDED: { fa: 'موفق', en: 'Succeeded', tone: 'success' },
  FAILED: { fa: 'ناموفق', en: 'Failed', tone: 'danger' },
  PARTIALLY_REFUNDED: { fa: 'بخشی بازپرداخت‌شده', en: 'Partially refunded', tone: 'info' },
  REFUNDED: { fa: 'بازپرداخت‌شده', en: 'Refunded', tone: 'info' },
  CONFIRMED: { fa: 'تأییدشده', en: 'Confirmed', tone: 'success' },
  COMPLETED: { fa: 'تکمیل‌شده', en: 'Completed', tone: 'success' },
  CANCELLED: { fa: 'لغوشده', en: 'Cancelled', tone: 'neutral' },
  CANCELED: { fa: 'لغوشده', en: 'Cancelled', tone: 'neutral' },
  NO_SHOW: { fa: 'عدم حضور', en: 'No-show', tone: 'danger' },
  OPEN: { fa: 'باز', en: 'Open', tone: 'info' },
  WAITING_SUPPORT: { fa: 'منتظر پشتیبانی', en: 'Waiting for support', tone: 'warning' },
  WAITING_USER: { fa: 'منتظر کاربر', en: 'Waiting for user', tone: 'accent' },
  RESOLVED: { fa: 'حل‌شده', en: 'Resolved', tone: 'success' },
  CLOSED: { fa: 'بسته', en: 'Closed', tone: 'neutral' },
  DRAFT: { fa: 'پیش‌نویس', en: 'Draft', tone: 'neutral' },
  SUBMITTED: { fa: 'ارسال‌شده', en: 'Submitted', tone: 'info' },
  DOCUMENT_REVIEW: { fa: 'بررسی مدارک', en: 'Document review', tone: 'warning' },
  INTERVIEW: { fa: 'مصاحبه', en: 'Interview', tone: 'accent' },
  DEMO_REVIEW: { fa: 'بررسی دمو', en: 'Demo review', tone: 'accent' },
  APPROVED: { fa: 'تأییدشده', en: 'Approved', tone: 'success' },
  PUBLISHED: { fa: 'منتشرشده', en: 'Published', tone: 'success' },
  REJECTED: { fa: 'ردشده', en: 'Rejected', tone: 'danger' },
  IN_PROGRESS: { fa: 'در حال انجام', en: 'In progress', tone: 'info' },
  NEEDS_REVISION: { fa: 'نیازمند اصلاح', en: 'Needs revision', tone: 'warning' },
  UNDER_REVIEW: { fa: 'در حال بررسی', en: 'Under review', tone: 'warning' },
  COUNTER_OFFERED: { fa: 'پیشنهاد متقابل', en: 'Counter-offered', tone: 'accent' },
  RECOMMENDED: { fa: 'پیشنهاد تأیید', en: 'Recommended', tone: 'info' },
  SENT: { fa: 'ارسال‌شده', en: 'Sent', tone: 'success' },
  DELIVERED: { fa: 'تحویل‌شده', en: 'Delivered', tone: 'success' },
  QUEUED: { fa: 'در صف', en: 'Queued', tone: 'warning' },
  PROCESSING: { fa: 'در حال پردازش', en: 'Processing', tone: 'info' },
  URGENT: { fa: 'فوری', en: 'Urgent', tone: 'danger' },
  HIGH: { fa: 'زیاد', en: 'High', tone: 'warning' },
  NORMAL: { fa: 'عادی', en: 'Normal', tone: 'neutral' },
  LOW: { fa: 'کم', en: 'Low', tone: 'neutral' },
};

export function humanizeEnum(value: string) {
  const words = value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function statusLabel(value: string | null | undefined, locale: Locale) {
  if (!value) return '—';
  const entry = STATUS[value.toUpperCase()];
  return entry ? entry[locale] : humanizeEnum(value);
}

export function statusTone(value: string | null | undefined): StatusTone {
  return (value && STATUS[value.toUpperCase()]?.tone) || 'neutral';
}

export function isKnownStatus(value: unknown): value is string {
  return typeof value === 'string' && value.toUpperCase() in STATUS;
}

const SKILLS: Record<string, { fa: string; en: string }> = {
  conversation: { fa: 'مکالمه', en: 'Conversation' },
  speaking: { fa: 'گفتار', en: 'Speaking' },
  listening: { fa: 'شنیدار', en: 'Listening' },
  reading: { fa: 'خواندن', en: 'Reading' },
  writing: { fa: 'نوشتن', en: 'Writing' },
  grammar: { fa: 'گرامر', en: 'Grammar' },
  vocabulary: { fa: 'واژگان', en: 'Vocabulary' },
  'exam-preparation': { fa: 'آمادگی آزمون', en: 'Exam preparation' },
  ielts: { fa: 'آیلتس', en: 'IELTS' },
  business: { fa: 'زبان کاری', en: 'Business' },
  kids: { fa: 'کودکان', en: 'Kids' },
};

export function skillLabel(value: string, locale: Locale) {
  return SKILLS[value.toLowerCase()]?.[locale] ?? humanizeEnum(value);
}
