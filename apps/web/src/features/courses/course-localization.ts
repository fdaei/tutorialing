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
