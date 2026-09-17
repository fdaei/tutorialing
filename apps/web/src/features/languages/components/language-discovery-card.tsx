import Link from 'next/link';
import { ArrowLeft, BookOpen, Route, TrendingUp } from 'lucide-react';
import type { EducationalLanguage } from '../types';
import { localized, type Locale } from '@/lib/i18n';

export function LanguageDiscoveryCard({ language, locale }: { language: EducationalLanguage; locale: Locale }) {
  const name = localized({ fa: language.nameFa, en: language.nameEn }, locale);
  const english = locale === 'en';
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
            <span className="text-6xl" role="img" aria-label={name}>
              {language.flag || '🌐'}
            </span>
          </div>
        )}
        <span className="absolute start-4 top-4 chip bg-white/95 text-xs font-bold text-purple shadow-sm">
          {language.proficiencySystem === 'CEFR' ? 'A1 — C2' : 'Learning levels'}
        </span>
      </div>
      <div className="flex min-h-64 flex-col p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black">{name}</h2>
            <p className="latin mt-1 text-sm text-muted">{language.nativeName}</p>
          </div>
          <span className="text-2xl" aria-hidden="true">
            {language.flag || '🌐'}
          </span>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2 text-xs font-bold text-muted">
          <span className="flex items-center gap-2 rounded-xl bg-canvas px-3 py-2">
            <BookOpen size={15} />
            {english ? 'Focused lessons' : 'دروس هدفمند'}
          </span>
          <span className="flex items-center gap-2 rounded-xl bg-canvas px-3 py-2">
            <TrendingUp size={15} />
            {english ? 'Progress' : 'پیگیری پیشرفت'}
          </span>
        </div>
        <p className="mt-4 flex items-center gap-2 text-sm leading-7 text-muted">
          <Route size={17} aria-hidden="true" />
          {english ? 'Courses, assessment and teachers in one route' : 'دوره، تعیین سطح و مدرس در یک مسیر'}
        </p>
        <div className="mt-4 grid grid-cols-3 gap-1" aria-hidden="true">
          <span className="h-1.5 rounded-full bg-purple" />
          <span className="h-1.5 rounded-full bg-purple/30" />
          <span className="h-1.5 rounded-full bg-purple/15" />
        </div>
        <Link
          href={`/languages/${language.code}`}
          className="mt-auto flex min-h-11 items-center justify-between border-t hairline pt-5 text-sm font-black text-purple"
        >
          {english ? 'Explore this language' : 'دیدن مسیر این زبان'}
          <ArrowLeft className={english ? 'rotate-180' : undefined} size={17} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
