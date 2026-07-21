export const locales = ['fa', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'fa';

export function isLocale(value: string | null | undefined): value is Locale {
  return value === 'fa' || value === 'en';
}

export function direction(locale: Locale) { return locale === 'fa' ? 'rtl' : 'ltr'; }
export function localePath(pathname: string, locale: Locale) {
  const clean = pathname === '/en' ? '/' : pathname.replace(/^\/en(?=\/)/, '');
  return locale === 'en' ? (clean === '/' ? '/en' : `/en${clean}`) : clean;
}

export const messages = {
  fa: {
    language: 'زبان', persian: 'فارسی', english: 'English', brand: 'لینگواسپیک',
    teachers: 'مدرس‌ها', placement: 'آزمون تعیین سطح', matching: 'تطبیق هوشمند', dashboard: 'پنل من',
    signIn: 'ورود', findTeacher: 'پیدا کردن مدرس', mainNavigation: 'ناوبری اصلی', openMenu: 'باز کردن منو',
    notifications: 'اعلان‌ها', menu: 'منو', forbidden: 'دسترسی مجاز نیست', backDashboard: 'بازگشت به پنل',
    trial: 'جلسه آزمایشی', viewBook: 'مشاهده و رزرو', verified: 'مدرس تأییدشده',
    genericError: 'درخواست انجام نشد. لطفاً دوباره تلاش کنید.', required: 'این فیلد الزامی است.', invalid: 'اطلاعات واردشده معتبر نیست.',
  },
  en: {
    language: 'Language', persian: 'فارسی', english: 'English', brand: 'LingoSpeak',
    teachers: 'Teachers', placement: 'Placement test', matching: 'Smart matching', dashboard: 'My dashboard',
    signIn: 'Sign in', findTeacher: 'Find a teacher', mainNavigation: 'Main navigation', openMenu: 'Open menu',
    notifications: 'Notifications', menu: 'Menu', forbidden: 'Access denied', backDashboard: 'Back to dashboard',
    trial: 'Trial lesson', viewBook: 'View and book', verified: 'Verified teacher',
    genericError: 'The request could not be completed. Please try again.', required: 'This field is required.', invalid: 'The provided information is invalid.',
  },
} as const;

export type MessageKey = keyof typeof messages.fa;
export function translate(locale: Locale, key: MessageKey) { return messages[locale][key] ?? messages.fa[key] ?? key; }
export function formatNumber(value: number, locale: Locale) { return new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US').format(value); }
export function formatMoney(value: number, locale: Locale) { return new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US', { style:'currency', currency:'IRR', maximumFractionDigits:0 }).format(value); }
export function formatDate(value: Date | string, locale: Locale) { return new Intl.DateTimeFormat(locale === 'fa' ? 'fa-IR-u-ca-persian' : 'en-US', { dateStyle:'medium', timeStyle:'short' }).format(new Date(value)); }
