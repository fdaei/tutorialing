'use client';
import { Languages } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/shared/services/api';
import { localePath, type Locale, translate } from '@/lib/i18n';
import { useTranslations } from '@/components/shared/locale-provider';

/**
 * Switching locale keeps the current path and query. Layouts survive client
 * navigation, so `lang`/`dir` on <html> are updated here rather than left to
 * the root layout.
 */
export function useLocaleSwitch() {
  const { locale, setLocale } = useTranslations(),
    pathname = usePathname(),
    query = useSearchParams(),
    router = useRouter();
  return function change(next: Locale) {
    if (next === locale) return;
    setLocale(next);
    document.documentElement.lang = next === 'fa' ? 'fa-IR' : 'en';
    document.documentElement.dir = next === 'fa' ? 'rtl' : 'ltr';
    document.cookie = `lingospeak_locale=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    const search = query.toString();
    if (sessionStorage.getItem('access_token'))
      api('/users/me/locale', { method: 'PUT', body: JSON.stringify({ locale: next }) }).catch(() => undefined);
    router.replace(`${localePath(pathname, next)}${search ? `?${search}` : ''}`);
  };
}

export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { locale, t } = useTranslations(),
    change = useLocaleSwitch();
  return (
    <label className={`inline-flex items-center gap-2 ${className}`} aria-label={t('language')}>
      <Languages size={17} />
      <select
        dir={translate(locale, 'supportmyTicketManagerLtr')}
        lang={translate(locale, 'panelpanelActionsEn')}
        value={locale}
        onChange={(e) => change(e.target.value as Locale)}
        className="bg-transparent text-sm font-bold"
        aria-label={t('language')}
      >
        <option value="fa">{t('persian')}</option>
        <option value="en">{t('english')}</option>
      </select>
    </label>
  );
}

/** One-tap toggle between the two locales, labelled in the target language. */
export function LanguageToggle({ className = '' }: { className?: string }) {
  const { locale, t } = useTranslations(),
    change = useLocaleSwitch(),
    next: Locale = locale === 'en' ? 'fa' : 'en';
  return (
    <button type="button" onClick={() => change(next)} className={className} lang={next === 'fa' ? 'fa-IR' : 'en'} aria-label={t('language')}>
      <Languages size={16} aria-hidden="true" />
      {next === 'fa' ? 'فارسی' : 'English'}
    </button>
  );
}
