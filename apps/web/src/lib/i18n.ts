import { generatedMessages } from './generated-messages';
import { legacyGeneratedMessages } from './legacy-generated-messages';

export const locales = ['fa', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'fa';

const localeConfig: Record<Locale, { tag: string; direction: 'rtl' | 'ltr'; dateTag: string; prefix: string }> = {
  fa: { tag: 'fa-IR', direction: 'rtl', dateTag: 'fa-IR-u-ca-persian', prefix: '' },
  en: { tag: 'en', direction: 'ltr', dateTag: 'en-US', prefix: '/en' },
};

export function isLocale(value: string | null | undefined): value is Locale {
  return value === 'fa' || value === 'en';
}

/** Normalizes untrusted route/header/storage values to the supported locale set. */
export function resolveLocale(value: string | null | undefined): Locale {
  return isLocale(value) ? value : defaultLocale;
}

/** Compatibility helper for UI adapters that still require an RTL boolean. */
export function isDefaultLocale(locale: Locale) {
  return locale === defaultLocale;
}

export function direction(locale: Locale) {
  return localeConfig[locale].direction;
}
export function localeTag(locale: Locale) {
  return localeConfig[locale].tag;
}
export function localePath(pathname: string, locale: Locale) {
  const prefixes = locales
    .map((item) => localeConfig[item].prefix)
    .filter(Boolean)
    .join('|');
  const clean = prefixes ? pathname.replace(new RegExp(`^(?:${prefixes})(?=/|$)`), '') || '/' : pathname;
  const prefix = localeConfig[locale].prefix;
  return prefix ? (clean === '/' ? prefix : `${prefix}${clean}`) : clean;
}

export const messages = {
  fa: {
    ...generatedMessages.fa,
    ...legacyGeneratedMessages.fa,
    language: 'زبان',
    persian: 'فارسی',
    english: 'انگلیسی',
    brand: 'لینگواسپیک',
    teachers: 'مدرس‌ها',
    placement: 'آزمون تعیین سطح',
    matching: 'تطبیق هوشمند',
    dashboard: 'پنل من',
    signIn: 'ورود',
    findTeacher: 'پیدا کردن مدرس',
    mainNavigation: 'ناوبری اصلی',
    openMenu: 'باز کردن منو',
    notifications: 'اعلان‌ها',
    menu: 'منو',
    forbidden: 'دسترسی مجاز نیست',
    backDashboard: 'بازگشت به پنل',
    trial: 'جلسه آزمایشی',
    viewBook: 'مشاهده و رزرو',
    verified: 'مدرس تأییدشده',
    genericError: 'درخواست انجام نشد. لطفاً دوباره تلاش کنید.',
    required: 'این فیلد الزامی است.',
    invalid: 'اطلاعات واردشده معتبر نیست.',
    blogEyebrow: 'مجله لینگواسپیک',
    blogTitle: 'ایده‌هایی برای یادگیری بهتر',
    blogSearch: 'جست‌وجو',
    blogLoading: 'در حال بارگذاری…',
    blogEmpty: 'مقاله‌ای پیدا نشد.',
    blogBack: 'بازگشت به بلاگ',
    blogAuthor: 'نویسنده',
    blogViews: 'بازدید',
    blogDefaultAuthor: 'تیم لینگواسپیک',
    metaTitle: 'لینگواسپیک | مدرس خصوصی آیلتس',
    metaDescription: 'تعیین سطح، تطبیق هوشمند با مدرس تأییدشده و برنامه شخصی آیلتس.',
    studentPanel: 'پنل زبان‌آموز',
    dashboardMotto: 'هر روز یک قدم رو به جلو',
    dashboardGreeting: 'سلام',
    dashboardGuest: 'زبان‌آموز',
    dashboardStayInFlow: 'در مسیر بمان.',
    dashboardIntro:
      'برنامه‌ات را ادامه بده، کلاس بعدی و نتیجه آزمون‌ها را ببین و از همین‌جا با مدرس و پشتیبانی در ارتباط باش.',
    continueLearningPlan: 'ادامه برنامه یادگیری',
    startPlacement: 'شروع تعیین سطح',
    tests: 'آزمون‌ها',
    classes: 'کلاس‌ها',
    latestApprovedBand: 'آخرین نمره تأییدشده',
    nextClass: 'کلاس بعدی شما',
    nextStep: 'مرحله بعدی',
    classWith: 'کلاس با',
    teacherFallback: 'مدرس',
    chooseTeacher: 'انتخاب مدرس مناسب',
    smartRecommendations: 'پیشنهادهای هوشمند را مشاهده کنید',
    needsAttention: 'نیازمند توجه',
    viewPlacementResult: 'مشاهده نتیجه تعیین سطح',
    completePlacement: 'تکمیل تعیین سطح',
    resultReady: 'نتیجه شما آماده است',
    assessToBegin: 'برای شروع مسیر، سطح خود را مشخص کنید',
    learningJourney: 'مسیر یادگیری من',
    viewAll: 'مشاهده همه',
    createAccount: 'ساخت حساب کاربری',
    completed: 'تکمیل‌شده',
    assessLevel: 'ارزیابی سطح زبان',
    yourNextStep: 'مرحله بعدی شما',
    chooseATeacher: 'انتخاب مدرس',
    active: 'فعال',
    afterAssessment: 'پس از تعیین سطح',
    startClasses: 'شروع کلاس‌ها',
    booked: 'رزرو شده',
    waitingForBooking: 'در انتظار رزرو',
    done: 'انجام شد',
    start: 'شروع',
    needHelp: 'نیاز به راهنمایی دارید؟',
    supportIntro: 'تیم پشتیبانی آماده است تا در مسیر یادگیری همراه شما باشد.',
    createTicket: 'ایجاد تیکت جدید',
    placementEyebrow: 'تعیین سطح مخصوص هر زبان',
    placementTitle: 'اول زبان هدف را انتخاب کن؛ بعد آزمون مناسب همان زبان را شروع کن.',
    placementDescription:
      'سؤال‌ها، فایل‌های شنیداری و معیارهای سطح‌بندی هر زبان مستقل هستند. آزمون آلمانی هیچ سؤال انگلیسی نمایش نمی‌دهد.',
    educationalLanguageStep: '۱. زبان آموزشی',
    languagesLoadError: 'فهرست زبان‌ها دریافت نشد.',
    publishedAssessmentStep: '۲. آزمون منتشرشده',
    selectLanguageFirst: 'برای دیدن آزمون‌ها ابتدا یک زبان انتخاب کنید.',
    assessmentsLoadError: 'آزمون‌های این زبان دریافت نشدند.',
    minuteShort: 'دقیقه',
    minutes: 'دقیقه',
    prepareTest: 'آماده‌سازی آزمون',
    noAssessment: 'برای این زبان هنوز آزمون منتشرشده‌ای وجود ندارد.',
    getReady: 'پیش از شروع آماده باش',
    deviceTitle: 'رایانه یا تبلت',
    deviceDetail: 'برای آزمون‌های طولانی، رایانه تجربه بهتری دارد.',
    audioEquipmentTitle: 'هدفون و میکروفون',
    audioEquipmentDetail: 'برای Listening و Speaking دسترسی صدا لازم است.',
    stableInternetTitle: 'اینترنت پایدار',
    stableInternetDetail: 'پاسخ‌ها به‌صورت خودکار ذخیره و پس از اتصال بازیابی می‌شوند.',
    developmentGateway: 'درگاه توسعه',
    paymentSimulator: 'شبیه‌ساز تأیید پرداخت',
    paymentSimulatorDescription:
      'در محیط عملیاتی، کاربر به زرین‌پال منتقل می‌شود. این آداپتر همان callback سمت سرور را اجرا می‌کند.',
    verifying: 'در حال تأیید…',
    confirmDevelopmentPayment: 'تأیید پرداخت توسعه',
    verificationFailed: 'تأیید ناموفق بود.',
  },
  en: {
    ...generatedMessages.en,
    ...legacyGeneratedMessages.en,
    language: 'Language',
    persian: 'فارسی',
    english: 'English',
    brand: 'LingoSpeak',
    teachers: 'Teachers',
    placement: 'Placement test',
    matching: 'Smart matching',
    dashboard: 'My dashboard',
    signIn: 'Sign in',
    findTeacher: 'Find a teacher',
    mainNavigation: 'Main navigation',
    openMenu: 'Open menu',
    notifications: 'Notifications',
    menu: 'Menu',
    forbidden: 'Access denied',
    backDashboard: 'Back to dashboard',
    trial: 'Trial lesson',
    viewBook: 'View and book',
    verified: 'Verified teacher',
    genericError: 'The request could not be completed. Please try again.',
    required: 'This field is required.',
    invalid: 'The provided information is invalid.',
    blogEyebrow: 'LingoSpeak magazine',
    blogTitle: 'Ideas for learning better',
    blogSearch: 'Search',
    blogLoading: 'Loading…',
    blogEmpty: 'No articles found.',
    blogBack: 'Back to blog',
    blogAuthor: 'Author',
    blogViews: 'views',
    blogDefaultAuthor: 'LingoSpeak team',
    metaTitle: 'LingoSpeak | Private IELTS teachers',
    metaDescription: 'IELTS assessment, verified teacher matching, and personal learning plans.',
    studentPanel: 'Student dashboard',
    dashboardMotto: 'One step forward every day',
    dashboardGreeting: 'Hi',
    dashboardGuest: 'there',
    dashboardStayInFlow: 'stay in flow.',
    dashboardIntro:
      'Continue your plan, view your next class and test results, and stay connected with your teacher and support.',
    continueLearningPlan: 'Continue learning plan',
    startPlacement: 'Start placement test',
    tests: 'Tests',
    classes: 'Classes',
    latestApprovedBand: 'Latest approved band',
    nextClass: 'Your next class',
    nextStep: 'Next step',
    classWith: 'Class with',
    teacherFallback: 'your teacher',
    chooseTeacher: 'Choose the right teacher',
    smartRecommendations: 'View your smart recommendations',
    needsAttention: 'Needs attention',
    viewPlacementResult: 'View placement result',
    completePlacement: 'Complete placement test',
    resultReady: 'Your result is ready',
    assessToBegin: 'Assess your level to begin',
    learningJourney: 'My learning journey',
    viewAll: 'View all',
    createAccount: 'Create your account',
    completed: 'Completed',
    assessLevel: 'Assess your level',
    yourNextStep: 'Your next step',
    chooseATeacher: 'Choose a teacher',
    active: 'Active',
    afterAssessment: 'After assessment',
    startClasses: 'Start classes',
    booked: 'Booked',
    waitingForBooking: 'Waiting for booking',
    done: 'Done',
    start: 'Start',
    needHelp: 'Need a hand?',
    supportIntro: 'Our support team is ready to help throughout your learning journey.',
    createTicket: 'Create a ticket',
    placementEyebrow: 'Language-specific placement',
    placementTitle: 'Choose your target language first, then start the right test for that language.',
    placementDescription:
      'Questions, listening files, and proficiency rules are isolated by language. A German assessment never shows English questions.',
    educationalLanguageStep: '1. Educational language',
    languagesLoadError: 'Could not load languages.',
    publishedAssessmentStep: '2. Published assessment',
    selectLanguageFirst: 'Select a language to see its assessments.',
    assessmentsLoadError: 'Could not load assessments for this language.',
    minuteShort: 'min',
    minutes: 'minutes',
    prepareTest: 'Prepare test',
    noAssessment: 'No assessment has been published for this language yet.',
    getReady: 'Get ready before you start',
    deviceTitle: 'Computer or tablet',
    deviceDetail: 'A computer gives a better experience for longer tests.',
    audioEquipmentTitle: 'Headphones and microphone',
    audioEquipmentDetail: 'Audio access is required for Listening and Speaking.',
    stableInternetTitle: 'Stable internet',
    stableInternetDetail: 'Answers autosave and recover after reconnection.',
    developmentGateway: 'Development gateway',
    paymentSimulator: 'Payment verification simulator',
    paymentSimulatorDescription:
      'In production, the user is redirected to the payment provider. This adapter executes the same server callback.',
    verifying: 'Verifying…',
    confirmDevelopmentPayment: 'Confirm development payment',
    verificationFailed: 'Verification failed.',
  },
} as const;

export type MessageKey = keyof typeof messages.fa;
export function translate(locale: Locale | boolean, key: MessageKey) {
  const resolvedLocale: Locale = typeof locale === 'boolean' ? (locale ? 'fa' : 'en') : locale;
  return messages[resolvedLocale][key] ?? messages.fa[key] ?? key;
}
export function formatNumber(value: number, locale: Locale) {
  return new Intl.NumberFormat(localeConfig[locale].tag).format(value);
}
export function formatMoney(value: number, locale: Locale) {
  return new Intl.NumberFormat(localeConfig[locale].tag, {
    style: 'currency',
    currency: 'IRR',
    maximumFractionDigits: 0,
  }).format(value);
}
export function formatDate(value: Date | string, locale: Locale) {
  return new Intl.DateTimeFormat(localeConfig[locale].dateTag, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export type LocalizedValue<T = string> = Partial<Record<Locale, T | null | undefined>>;

/** Selects localized API content with a predictable fallback. */
export function localized<T>(value: LocalizedValue<T>, locale: Locale | boolean): T {
  const resolvedLocale: Locale = typeof locale === 'boolean' ? (locale ? 'fa' : 'en') : locale;
  return (value[resolvedLocale] ?? value[defaultLocale] ?? Object.values(value).find(Boolean) ?? '') as T;
}
