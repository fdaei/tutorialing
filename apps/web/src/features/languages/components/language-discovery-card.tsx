import Link from 'next/link';
import { ArrowLeft, Route } from 'lucide-react';
import type { EducationalLanguage } from '../types';
import { localized, type Locale } from '@/lib/i18n';

export function LanguageDiscoveryCard({ language, locale }: { language: EducationalLanguage; locale: Locale }) {
  const name = localized({ fa: language.nameFa, en: language.nameEn }, locale);
  return (
    <article className="market-card lift group overflow-hidden p-0">
      <div className="relative aspect-[16/10] overflow-hidden bg-[#eef2ff]">
        {language.imageUrl ? (
          <img
            src={language.imageUrl}
            alt={name}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full place-items-center bg-[#eef2ff]">
            <span className="text-6xl" role="img" aria-label={name}>{language.flag || '🌐'}</span>
          </div>
        )}
        <span className="absolute start-4 top-4 chip bg-white/95 text-xs font-bold text-purple shadow-sm">
          {language.proficiencySystem === 'CEFR' ? 'A1 — C2' : 'Learning levels'}
        </span>
      </div>
      <div className="flex min-h-56 flex-col p-6">
        <h2 className="text-xl font-black">{name}</h2>
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
      </div>
    </article>
  );
}
