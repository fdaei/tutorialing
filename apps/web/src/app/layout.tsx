import type { Metadata } from 'next';
import { headers } from 'next/headers';
import '@fontsource-variable/vazirmatn';
import '@fontsource-variable/inter';
import './globals.css';
import { Providers } from './providers';
import { direction, isLocale } from '@/lib/i18n';
import { webConfig } from '@/config';
import { GoogleAnalytics } from '@/components/analytics/google-analytics';
export async function generateMetadata(): Promise<Metadata> {
  const value = (await headers()).get('x-lingospeak-locale'),
    locale = isLocale(value) ? value : 'fa',
    fa = locale === 'fa';
  return {
    metadataBase: new URL(webConfig.webUrl),
    title: {
      default: fa ? 'لینگواسپیک | مدرس خصوصی آیلتس' : 'LingoSpeak | Private IELTS teachers',
      template: '%s | LingoSpeak',
    },
    description: fa
      ? 'تعیین سطح، تطبیق هوشمند با مدرس تأییدشده و برنامه شخصی آیلتس.'
      : 'IELTS assessment, verified teacher matching, and personal learning plans.',
    alternates: { canonical: fa ? '/' : '/en', languages: { 'fa-IR': '/', en: '/en', 'x-default': '/' } },
  };
}
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const value = (await headers()).get('x-lingospeak-locale'),
    locale = isLocale(value) ? value : 'fa';
  return (
    <html
      lang={locale === 'fa' ? 'fa-IR' : 'en'}
      dir={direction(locale)}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body>
        <GoogleAnalytics />
        <Providers locale={locale}>{children}</Providers>
      </body>
    </html>
  );
}
