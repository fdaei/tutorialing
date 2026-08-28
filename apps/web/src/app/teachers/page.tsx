'use client';

import { localized, isDefaultLocale, translate } from '@/lib/i18n';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, RotateCcw } from 'lucide-react';
import { Header, Footer, Empty } from '@/components/layout/site';
import { TeacherCard } from '@/features/teacher/components/teacher-card';
import { publicApi, type Paginated, type PublicTeacher } from '@/lib/api';
import { useTranslations } from '@/components/shared/locale-provider';
export default function Directory() {
  const { locale } = useTranslations(),
    fa = isDefaultLocale(locale),
    [q, setQ] = useState(''),
    [search, setSearch] = useState(''),
    [skill, setSkill] = useState(''),
    [sort, setSort] = useState('rating'),
    [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['teachers', search, skill, sort, page],
    queryFn: () =>
      publicApi<Paginated<PublicTeacher>>(
        `/teachers?page=${page}&limit=9&search=${encodeURIComponent(search)}&skill=${skill}&sort=${sort}`,
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
          className="sticky top-24 z-20 mt-10 grid gap-3 rounded-3xl border hairline bg-white/95 p-4 shadow-soft md:grid-cols-[1fr_200px_180px]"
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
            aria-label={translate(locale, 'teachersSort')}
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-2xl border hairline px-4"
          >
            <option value="rating">{translate(locale, 'teachersHighestRating')}</option>
            <option value="price_asc">{translate(locale, 'teachersLowestPrice')}</option>
            <option value="newest">{translate(locale, 'teachersNewest')}</option>
          </select>
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
                {page} / {query.data.totalPages || 1}
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
