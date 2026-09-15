import type { Metadata } from 'next';
import { headers } from 'next/headers';
import '@fontsource-variable/vazirmatn';
import '@fontsource-variable/inter';
import '@fontsource-variable/estedad';
import '@fontsource-variable/noto-sans-arabic';
import './globals.css';
import { Providers } from './providers';
import { direction, localePath, localeTag, resolveLocale, translate } from '@/lib/i18n';
import { brandAssets, webConfig } from '@/config';
import { GoogleAnalytics } from '@/components/analytics/google-analytics';
import { publicApi } from '@/shared/services/api';
import { normalizeTheme, typographyStyle } from '@/features/landing';

type PublicSetting = { key: string; value: unknown };

// Typography is edited in Admin > Website builder > Theme; a short revalidate keeps
// every page from paying a settings round-trip while picking up changes quickly.
async function siteTheme() {
  const settings = await publicApi<PublicSetting[]>('/support/public-settings', { cache: 'force-cache', next: { revalidate: 30 } }).catch(() => []);
  return normalizeTheme(settings.find((setting) => setting.key === 'theme.settings')?.value);
}
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
    icons: { icon: brandAssets.mark, apple: brandAssets.mark },
    alternates: { canonical: localePath('/', locale), languages: { 'fa-IR': '/', en: '/en', 'x-default': '/' } },
  };
}
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const value = (await headers()).get('x-lingospeak-locale'),
    locale = resolveLocale(value),
    theme = await siteTheme();
  return (
    <html lang={localeTag(locale)} dir={direction(locale)} style={typographyStyle(theme)} data-scroll-behavior="smooth" suppressHydrationWarning>
      <body>
        <GoogleAnalytics />
        <Providers locale={locale}>{children}</Providers>
      </body>
    </html>
  );
}
