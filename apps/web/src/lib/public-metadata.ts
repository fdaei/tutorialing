import 'server-only';
import type { Metadata } from 'next';
import { localePath, localized } from './i18n';
import { requestLocale } from './server-locale';

type LocalizedCopy = { fa: string; en: string };

export async function publicPageMetadata(path: string, title: LocalizedCopy, description: LocalizedCopy): Promise<Metadata> {
  const locale = await requestLocale();
  const localizedTitle = localized(title, locale);
  const localizedDescription = localized(description, locale);
  const canonical = localePath(path, locale);

  return {
    title: localizedTitle,
    description: localizedDescription,
    alternates: {
      canonical,
      languages: { 'fa-IR': localePath(path, 'fa'), en: localePath(path, 'en'), 'x-default': localePath(path, 'fa') },
    },
    openGraph: {
      type: 'website',
      siteName: 'LingoSpeak',
      title: localizedTitle,
      description: localizedDescription,
      url: canonical,
      locale: locale === 'fa' ? 'fa_IR' : 'en_US',
    },
    twitter: { card: 'summary', title: localizedTitle, description: localizedDescription },
  };
}
