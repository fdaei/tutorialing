'use client';

import Link from 'next/link';
import { Clock, Headphones, Laptop, Wifi, ArrowRight, BookOpen } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Header, Footer, Eyebrow } from '@/components/layout/site';
import { publicApi, type EducationalLanguage } from '@/lib/api';
import { useTranslations } from '@/components/shared/locale-provider';
import { localePath, localized } from '@/lib/i18n';
import { useState } from 'react';

type Test = {
  id: string;
  slug: string;
  languageId: string;
  level?: string;
  titleFa: string;
  titleEn: string;
  descriptionFa: string;
  descriptionEn: string;
  durationMinutes: number;
  language: Pick<EducationalLanguage, 'code' | 'nameFa' | 'nameEn' | 'nativeName' | 'flag' | 'direction'>;
  sections: { skill: string; title: string; durationMinutes: number; order: number }[];
};

export default function Placement() {
  const { locale, t } = useTranslations(),
    p = (href: string) => localePath(href, locale),
    [languageId, setLanguageId] = useState('');
  const languages = useQuery({
    queryKey: ['educational-languages'],
    queryFn: () => publicApi<EducationalLanguage[]>('/languages'),
  });
  const tests = useQuery({
    queryKey: ['published-tests', languageId],
    queryFn: () => publicApi<Test[]>(`/tests?languageId=${encodeURIComponent(languageId)}`),
    enabled: !!languageId,
  });
  const checks = [
    [Laptop, t('deviceTitle'), t('deviceDetail')],
    [Headphones, t('audioEquipmentTitle'), t('audioEquipmentDetail')],
    [Wifi, t('stableInternetTitle'), t('stableInternetDetail')],
  ] as const;
  return (
    <>
      <Header />
      <main>
        <section className="mx-auto max-w-7xl px-6 py-16">
          <div className="max-w-3xl">
            <Eyebrow>{t('placementEyebrow')}</Eyebrow>
            <h1 className="mt-5 text-5xl font-black leading-tight md:text-6xl">{t('placementTitle')}</h1>
            <p className="mt-6 text-lg leading-9 text-muted">{t('placementDescription')}</p>
          </div>
          <div className="mt-12 rounded-4xl border hairline bg-white p-6 shadow-soft">
            <h2 className="text-xl font-black">{t('educationalLanguageStep')}</h2>
            {languages.isLoading ? (
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {Array.from({ length: 8 }, (_, i) => (
                  <div key={i} className="skeleton h-20 rounded-2xl" />
                ))}
              </div>
            ) : languages.isError ? (
              <ErrorState text={t('languagesLoadError')} />
            ) : (
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {languages.data?.map((language) => (
                  <button
                    key={language.id}
                    onClick={() => setLanguageId(language.id)}
                    className={`rounded-2xl border p-4 text-start transition ${languageId === language.id ? 'border-purple bg-lavender text-purple ring-2 ring-purple/10' : 'hairline hover:border-purple'}`}
                  >
                    <span className="text-2xl">{language.flag || '🌐'}</span>
                    <strong className="mt-2 block">
                      {localized({ fa: language.nameFa, en: language.nameEn }, locale)}
                    </strong>
                    <small className="mt-1 block text-muted">{language.nativeName}</small>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="mt-7 rounded-4xl border hairline bg-white p-6 shadow-soft">
            <h2 className="text-xl font-black">{t('publishedAssessmentStep')}</h2>
            {!languageId ? (
              <p className="mt-5 rounded-2xl border border-dashed hairline p-8 text-center text-muted">
                {t('selectLanguageFirst')}
              </p>
            ) : tests.isLoading ? (
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="skeleton h-56 rounded-3xl" />
                <div className="skeleton h-56 rounded-3xl" />
              </div>
            ) : tests.isError ? (
              <ErrorState text={t('assessmentsLoadError')} />
            ) : tests.data?.length ? (
              <div className="mt-5 grid gap-5 md:grid-cols-2">
                {tests.data.map((test) => (
                  <article key={test.id} className="rounded-3xl border hairline p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <span className="rounded-full bg-lavender px-3 py-1 text-xs font-black text-purple">
                          {test.level || test.language.nativeName}
                        </span>
                        <h3 className="mt-4 text-xl font-black">
                          {localized({ fa: test.titleFa, en: test.titleEn }, locale)}
                        </h3>
                      </div>
                      <BookOpen className="text-purple" />
                    </div>
                    <p className="mt-3 min-h-14 text-sm leading-7 text-muted">
                      {localized({ fa: test.descriptionFa, en: test.descriptionEn }, locale)}
                    </p>
                    <div className="mt-5 flex flex-wrap gap-2">
                      {test.sections.map((section) => (
                        <span
                          key={`${test.id}-${section.skill}`}
                          className="rounded-full border hairline px-3 py-1 text-xs"
                        >
                          {section.skill} · {section.durationMinutes} {t('minuteShort')}
                        </span>
                      ))}
                    </div>
                    <div className="mt-6 flex items-center justify-between border-t hairline pt-5">
                      <span className="flex items-center gap-2 text-sm text-muted">
                        <Clock size={16} />
                        {test.durationMinutes} {t('minutes')}
                      </span>
                      <Link
                        href={p(`/test/device-check?test=${test.id}`)}
                        className="brand-gradient flex items-center gap-2 rounded-xl px-5 py-3 font-black text-white"
                      >
                        {t('prepareTest')}
                        <ArrowRight className="rtl:rotate-180" size={17} />
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-5 rounded-2xl border border-dashed hairline p-8 text-center text-muted">
                {t('noAssessment')}
              </p>
            )}
          </div>
        </section>
        <section className="bg-navy py-18 text-white">
          <div className="mx-auto max-w-7xl px-6 py-16">
            <h2 className="text-3xl font-black">{t('getReady')}</h2>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {checks.map(([I, title, detail]) => {
                const Icon = I as typeof Clock;
                return (
                  <div className="rounded-3xl border border-white/15 p-6" key={String(title)}>
                    <Icon className="text-violet" />
                    <h3 className="mt-5 font-black">{String(title)}</h3>
                    <p className="mt-2 text-sm leading-7 text-white/55">{String(detail)}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
function ErrorState({ text }: { text: string }) {
  return (
    <div role="alert" className="mt-5 rounded-2xl border border-red-100 bg-red-50 p-5 text-red-800">
      {text}
    </div>
  );
}
