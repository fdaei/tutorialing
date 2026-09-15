import type { Locale } from '@/lib/i18n';

const englishLanguageNames: Readonly<Record<string, string>> = {
  انگلیسی: 'English',
  آلمانی: 'German',
  اسپانیایی: 'Spanish',
  ترکی: 'Turkish',
  فرانسوی: 'French',
  ایتالیایی: 'Italian',
  پرتغالی: 'Portuguese',
  کره‌ای: 'Korean',
  عربی: 'Arabic',
  روسی: 'Russian',
};

export function localizedCourseLanguage(language: string, locale: Locale) {
  return locale === 'en' ? (englishLanguageNames[language] ?? language) : language;
}

const categoryLabels: Readonly<Record<string, { fa: string; en: string }>> = {
  'private-class': { fa: 'کلاس خصوصی ترمی', en: 'Private term' },
  'single-skill': { fa: 'تک‌مهارتی آیلتس', en: 'IELTS single skill' },
  'writing-correction': { fa: 'تصحیح رایتینگ', en: 'Writing correction' },
  mentoring: { fa: 'منتورینگ', en: 'Mentoring' },
  'single-session': { fa: 'جلسه آزمایشی', en: 'Single session' },
};

export function localizedCourseCategory(category: string, locale: Locale) {
  const label = categoryLabels[category];
  return label ? label[locale] : category;
}

const deliveryLabels: Readonly<Record<string, { fa: string; en: string }>> = {
  ONLINE: { fa: 'آنلاین', en: 'Online' },
  IN_PERSON: { fa: 'حضوری', en: 'In person' },
  HYBRID: { fa: 'ترکیبی', en: 'Hybrid' },
};

export function localizedCourseDelivery(delivery: string, locale: Locale) {
  const label = deliveryLabels[delivery];
  return label ? label[locale] : delivery;
}

export function localizedCourseLevel(level: string, locale: Locale) {
  if (level === 'All levels') return locale === 'en' ? 'All levels' : 'همه سطح‌ها';
  return level;
}

/** First paragraph of a course description, for cards and hero blurbs. */
export function courseBlurb(description: string | null | undefined) {
  return (description ?? '').split(/\n\s*\n/)[0]?.trim() ?? '';
}
