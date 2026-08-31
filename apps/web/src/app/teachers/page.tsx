'use client';

import { translate } from '@/lib/i18n';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { Header, Footer, Empty } from '@/components/layout/site';
import { TeacherCard } from '@/features/teacher/components/teacher-card';
import { publicApi, type Paginated } from '@/shared/services/api';
import type { PublicTeacher } from '@/features/teacher';
import { useTranslations } from '@/components/shared/locale-provider';
import type { EducationalLanguage } from '@/features/languages';
export default function Directory() {
  const { locale } = useTranslations(),
    [q, setQ] = useState(''),
    [search, setSearch] = useState(''),
    [skill, setSkill] = useState(''),
    [language, setLanguage] = useState(''),
    [minRating, setMinRating] = useState(''),
    [sort, setSort] = useState('rating'),
    [page, setPage] = useState(1);
  const english = locale === 'en';
  const languages = useQuery({
    queryKey: ['public-languages'],
    queryFn: () => publicApi<EducationalLanguage[]>('/languages'),
    staleTime: 10 * 60 * 1000,
  });
  const hasFilters = Boolean(q || search || skill || language || minRating || sort !== 'rating');
  const resetFilters = () => {
    setQ('');
    setSearch('');
    setSkill('');
    setLanguage('');
    setMinRating('');
    setSort('rating');
    setPage(1);
  };
  const query = useQuery({
    queryKey: ['teachers', search, skill, language, minRating, sort, page],
    queryFn: () =>
      publicApi<Paginated<PublicTeacher>>(
        `/teachers?page=${page}&limit=9&search=${encodeURIComponent(search)}&skill=${skill}&language=${language}&minRating=${minRating}&sort=${sort}`,
      ),
  });
  return (
    <>
      <Header />
      <main className="mx-auto max-w-7xl px-6 py-14">
        <p className="text-sm font-bold text-purple">{translate(locale, 'teachersVerifiedTeachers')}</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-black md:text-6xl">
          {translate(locale, 'teachersFindATeacherBuiltAroundYourGoal')}
        </h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(q);
            setPage(1);
          }}
          className="sticky top-20 z-20 mt-8 grid gap-3 rounded-3xl border hairline bg-white/95 p-4 shadow-soft sm:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_140px_140px_130px_160px_auto]"
        >
          <label className="flex items-center gap-3 rounded-2xl bg-ivory px-4">
            <Search />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full bg-transparent py-4 outline-none"
              placeholder={translate(locale, 'teachersTeacherNameOrSpecialty')}
            />
          </label>
          <select
            aria-label={english ? 'Language' : 'زبان'}
            value={language}
            onChange={(e) => {
              setLanguage(e.target.value);
              setPage(1);
            }}
            className="min-h-13 rounded-2xl border hairline px-4"
          >
            disabled={languages.isLoading || languages.isError}
            <option value="">{languages.isError ? (english ? 'Languages unavailable' : 'زبان‌ها در دسترس نیستند') : (english ? 'All languages' : 'همه زبان‌ها')}</option>
            {languages.data?.map((item) => (
              <option key={item.id} value={item.code}>{locale === 'en' ? item.nameEn : item.nameFa}</option>
            ))}
          </select>
          <select
            aria-label={translate(locale, 'teachersSkill')}
            value={skill}
            onChange={(e) => setSkill(e.target.value)}
            className="rounded-2xl border hairline px-4"
          >
            <option value="">{translate(locale, 'teachersAllSkills')}</option>
            {['writing', 'speaking', 'reading', 'listening'].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <select
            aria-label={english ? 'Minimum rating' : 'حداقل امتیاز'}
            value={minRating}
            onChange={(e) => {
              setMinRating(e.target.value);
              setPage(1);
            }}
            className="min-h-13 rounded-2xl border hairline px-4"
          >
            <option value="">{english ? 'Any rating' : 'همه امتیازها'}</option>
            <option value="4">{english ? '4 stars and up' : '۴ ستاره به بالا'}</option>
            <option value="4.5">{english ? '4.5 and up' : '۴٫۵ به بالا'}</option>
          </select>
          <select
            aria-label={translate(locale, 'teachersSort')}
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-2xl border hairline px-4"
          >
            <option value="rating">{translate(locale, 'teachersHighestRating')}</option>
            <option value="reviews">{english ? 'Most reviewed' : 'بیشترین نظر'}</option>
            <option value="price_asc">{translate(locale, 'teachersLowestPrice')}</option>
            <option value="newest">{translate(locale, 'teachersNewest')}</option>
          </select>
          <button type="submit" className="brand-gradient flex min-h-13 items-center justify-center gap-2 rounded-2xl px-5 font-black text-white">
            <Search size={18} aria-hidden="true" />
            {english ? 'Search' : 'جست‌وجو'}
          </button>
          {hasFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="flex min-h-11 items-center justify-center gap-2 rounded-xl text-sm font-bold text-muted hover:bg-canvas hover:text-purple sm:col-span-2 xl:col-span-6"
            >
              <SlidersHorizontal size={17} aria-hidden="true" />
              {english ? 'Clear search and all filters' : 'پاک کردن جست‌وجو و همه فیلترها'}
            </button>
          )}
        </form>
        {query.isLoading && (
          <div aria-label={translate(locale, 'teachersLoading')} className="mt-8 grid gap-6 lg:grid-cols-3">
            {[1, 2, 3].map((x) => (
              <div key={x} className="skeleton h-[420px] rounded-4xl" />
            ))}
          </div>
        )}
        {query.isError && (
          <div className="mt-8 rounded-3xl bg-red-50 p-7 text-red-800">
            <p className="font-black">{translate(locale, 'teachersCouldNotLoadTeachers')}</p>
            <button onClick={() => query.refetch()} className="mt-3 flex gap-2 font-bold">
              <RotateCcw size={18} />
              {translate(locale, 'testsaudioRecorderTryAgain')}
            </button>
          </div>
        )}
        {query.data && (
          <>
            <p className="mt-8 text-sm text-muted">
              {query.data.total.toLocaleString(translate(locale, 'commercepricingManagerEnUS2'))}{' '}
              {translate(locale, 'teachersVerifiedTeachers2')}
            </p>
            <div className="mt-5 grid gap-6 lg:grid-cols-3">
              {query.data.data.map((t) => (
                <TeacherCard key={t.id} teacher={t} />
              ))}
            </div>
            {!query.data.data.length && (
              <Empty
                title={translate(locale, 'teachersNoTeachersFound')}
                body={translate(locale, 'teachersTryChangingTheFilters')}
              />
            )}
            <div className="mt-10 flex justify-center gap-3">
              <button
                disabled={page <= 1}
                onClick={() => setPage((x) => x - 1)}
                className="rounded-full border hairline px-5 py-2 disabled:opacity-40"
              >
                {translate(locale, 'admincountryManagerPrevious')}
              </button>
              <span className="px-3 py-2">
                {page.toLocaleString(english ? 'en-US' : 'fa-IR')} / {(query.data.totalPages || 1).toLocaleString(english ? 'en-US' : 'fa-IR')}
              </span>
              <button
                disabled={page >= query.data.totalPages}
                onClick={() => setPage((x) => x + 1)}
                className="rounded-full border hairline px-5 py-2 disabled:opacity-40"
              >
                {translate(locale, 'admincountryManagerNext')}
              </button>
            </div>
          </>
        )}
      </main>
      <Footer />
    </>
  );
}
