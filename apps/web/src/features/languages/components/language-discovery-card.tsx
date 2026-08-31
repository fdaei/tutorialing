import Link from 'next/link';
import { ArrowLeft, Route } from 'lucide-react';
import type { EducationalLanguage } from '../types';
import { localized, type Locale } from '@/lib/i18n';

export function LanguageDiscoveryCard({ language, locale }: { language: EducationalLanguage; locale: Locale }) {
  const name = localized({ fa: language.nameFa, en: language.nameEn }, locale);
  return (
    <article className="market-card lift flex min-h-64 flex-col p-6">
      <div className="flex items-start justify-between gap-4">
        <span className="text-5xl" role="img" aria-label={name}>
          {language.flag || '🌐'}
        </span>
        <span className="chip latin text-xs font-bold text-purple">
          {language.proficiencySystem === 'CEFR' ? 'A1 — C2' : 'Learning levels'}
        </span>
      </div>
      <h2 className="mt-6 text-xl font-black">{name}</h2>
      <p className="latin mt-1 text-sm text-muted">{language.nativeName}</p>
      <p className="mt-4 flex items-center gap-2 text-sm leading-7 text-muted">
        <Route size={17} aria-hidden="true" />
        دوره‌ها، تعیین سطح و مدرس‌های این زبان
      </p>
      <Link
        href={`/languages/${language.code}`}
        className="mt-auto flex min-h-11 items-center justify-between border-t hairline pt-5 text-sm font-black text-purple"
      >
        دیدن مسیر این زبان
        <ArrowLeft size={17} aria-hidden="true" />
      </Link>
    </article>
  );
}
