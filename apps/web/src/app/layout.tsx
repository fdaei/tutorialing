import type { Metadata } from 'next';
import { headers } from 'next/headers';
import '@fontsource-variable/vazirmatn';
import '@fontsource-variable/inter';
import './globals.css';
import { Providers } from './providers';
import { direction, localePath, localeTag, resolveLocale, translate } from '@/lib/i18n';
import { webConfig } from '@/config';
import { GoogleAnalytics } from '@/components/analytics/google-analytics';
export async function generateMetadata(): Promise<Metadata> {
  const value = (await headers()).get('x-lingospeak-locale'),
    locale = resolveLocale(value);
  return {
    metadataBase: new URL(webConfig.webUrl),
    title: {
      default: translate(locale, 'metaTitle'),
      template: '%s | LingoSpeak',
    },
    description: translate(locale, 'metaDescription'),
    alternates: { canonical: localePath('/', locale), languages: { 'fa-IR': '/', en: '/en', 'x-default': '/' } },
  };
}
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const value = (await headers()).get('x-lingospeak-locale'),
    locale = resolveLocale(value);
  return (
    <html lang={localeTag(locale)} dir={direction(locale)} data-scroll-behavior="smooth" suppressHydrationWarning>
      <body>
        <GoogleAnalytics />
        <Providers locale={locale}>{children}</Providers>
      </body>
    </html>
  );
}
