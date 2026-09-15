'use client';

import { useMemo, useState } from 'react';
import { BookOpen, RotateCcw, Search } from 'lucide-react';
import { CourseCard } from '@/components/marketplace/cards';
import type { Course } from '@/lib/marketplace-data';
import { useTranslations } from '@/components/shared/locale-provider';
import {
  localizedCourseCategory,
  localizedCourseDelivery,
  localizedCourseLanguage,
  localizedCourseLevel,
} from '../course-localization';

type Sort = 'featured' | 'price-asc' | 'price-desc' | 'rating';

const CATEGORY_ORDER = ['private-class', 'single-skill', 'writing-correction', 'mentoring', 'single-session'];
const LEVEL_ORDER = ['A1', 'A2', 'A1–C1', 'B1', 'B2', 'C1', 'C2', 'IELTS', 'All levels'];

const unique = (values: (string | null | undefined)[]) => [
  ...new Set(values.filter((value): value is string => Boolean(value))),
];
const byOrder = (order: string[]) => (a: string, b: string) =>
  (order.indexOf(a) === -1 ? order.length : order.indexOf(a)) -
  (order.indexOf(b) === -1 ? order.length : order.indexOf(b));

export function CourseDirectory({
  courses,
  initialLanguage = '',
  initialLevel = '',
}: {
  courses: Course[];
  initialLanguage?: string;
  initialLevel?: string;
}) {
  const { locale } = useTranslations();
  const english = locale === 'en';
  const t = (fa: string, en: string) => (english ? en : fa);
  const numberLocale = english ? 'en-US' : 'fa-IR';

  const options = useMemo(
    () => ({
      languages: unique(courses.map((course) => course.language)),
      categories: unique(courses.map((course) => course.category)).sort(byOrder(CATEGORY_ORDER)),
      deliveries: unique(courses.map((course) => course.delivery)),
      levels: unique(courses.map((course) => course.level)).sort(byOrder(LEVEL_ORDER)),
      teachers: unique(courses.map((course) => course.teacherName ?? course.teacher)),
    }),
    [courses],
  );

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [delivery, setDelivery] = useState('');
  const [teacher, setTeacher] = useState('');
  const [sort, setSort] = useState<Sort>('featured');
  const [language, setLanguage] = useState(() => (options.languages.includes(initialLanguage) ? initialLanguage : ''));
  // A recommended CEFR level also matches the multi-level "A1–C1" courses that cover it.
  const [level, setLevel] = useState(() =>
    options.levels.includes(initialLevel) || /^(?:A1|A2|B1|B2|C1)$/.test(initialLevel) ? initialLevel : '',
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    const matchesLevel = (courseLevel: string) =>
      !level ||
      courseLevel === level ||
      courseLevel === 'All levels' ||
      (courseLevel === 'A1–C1' && /^(?:A1|A2|B1|B2|C1)$/.test(level));
    const list = courses.filter(
      (course) =>
        (!language || course.language === language) &&
        (!category || course.category === category) &&
        (!delivery || course.delivery === delivery) &&
        (!teacher || (course.teacherName ?? course.teacher) === teacher) &&
        matchesLevel(course.level) &&
        (!needle ||
          [course.titleFa, course.titleEn, course.title, course.descriptionFa, course.descriptionEn, course.teacherName]
            .filter(Boolean)
            .some((text) => text!.toLocaleLowerCase().includes(needle))),
    );
    if (sort === 'price-asc') return [...list].sort((a, b) => a.price - b.price);
    if (sort === 'price-desc') return [...list].sort((a, b) => b.price - a.price);
    if (sort === 'rating') return [...list].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    return list;
  }, [courses, query, language, category, delivery, teacher, level, sort]);

  const activeFilters = [query.trim(), language, category, delivery, teacher, level].filter(Boolean).length;
  const reset = () => {
    setQuery('');
    setLanguage('');
    setCategory('');
    setDelivery('');
    setTeacher('');
    setLevel('');
    setSort('featured');
  };

  const countFor = (key: 'category', value: string) => courses.filter((course) => course[key] === value).length;

  return (
    <section aria-labelledby="course-results-heading" className="mt-8">
      <div className="surface-card grid gap-4 p-4 md:p-5">
        <label className="relative block">
          <span className="sr-only">{t('جستجوی دوره', 'Search courses')}</span>
          <Search
            size={18}
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted ltr:left-4 rtl:right-4"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('جستجو در عنوان، توضیحات یا نام مدرس…', 'Search by title, description or teacher…')}
            className="min-h-12 w-full rounded-xl border hairline bg-white px-11 text-sm outline-none focus:border-purple"
          />
        </label>

        {options.categories.length > 1 && (
          <div className="flex flex-wrap gap-2" role="group" aria-label={t('نوع دوره', 'Course type')}>
            <FilterButton active={!category} onClick={() => setCategory('')}>
              {t('همه انواع', 'All types')}
              <Count value={courses.length} locale={numberLocale} />
            </FilterButton>
            {options.categories.map((option) => (
              <FilterButton key={option} active={category === option} onClick={() => setCategory(option)}>
                {localizedCourseCategory(option, locale)}
                <Count value={countFor('category', option)} locale={numberLocale} />
              </FilterButton>
            ))}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {options.languages.length > 1 && (
            <Select
              label={t('زبان', 'Language')}
              value={language}
              onChange={setLanguage}
              allLabel={t('همه زبان‌ها', 'All languages')}
            >
              {options.languages.map((option) => (
                <option key={option} value={option}>
                  {localizedCourseLanguage(option, locale)}
                </option>
              ))}
            </Select>
          )}
          <Select
            label={t('سطح / هدف', 'Level / goal')}
            value={level}
            onChange={setLevel}
            allLabel={t('همه سطح‌ها', 'All levels')}
          >
            {unique([...options.levels.filter((option) => option !== 'All levels'), level]).map((option) => (
              <option key={option} value={option}>
                {option === 'A1–C1' ? t('جنرال (A1 تا C1)', 'General (A1–C1)') : localizedCourseLevel(option, locale)}
              </option>
            ))}
          </Select>
          {options.deliveries.length > 1 && (
            <Select
              label={t('نحوه برگزاری', 'Format')}
              value={delivery}
              onChange={setDelivery}
              allLabel={t('آنلاین و حضوری', 'Any format')}
            >
              {options.deliveries.map((option) => (
                <option key={option} value={option}>
                  {localizedCourseDelivery(option, locale)}
                </option>
              ))}
            </Select>
          )}
          {options.teachers.length > 1 && (
            <Select
              label={t('مدرس', 'Teacher')}
              value={teacher}
              onChange={setTeacher}
              allLabel={t('همه مدرسان', 'All teachers')}
            >
              {options.teachers.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          )}
          <Select label={t('مرتب‌سازی', 'Sort by')} value={sort} onChange={(value) => setSort(value as Sort)}>
            <option value="featured">{t('پیشنهاد لینگواسپیک', 'Recommended')}</option>
            <option value="price-asc">{t('ارزان‌ترین', 'Price: low to high')}</option>
            <option value="price-desc">{t('گران‌ترین', 'Price: high to low')}</option>
            <option value="rating">{t('بیشترین امتیاز', 'Highest rated')}</option>
          </Select>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 id="course-results-heading" className="text-lg font-black">
          {category ? localizedCourseCategory(category, locale) : t('همه دوره‌ها', 'All courses')}
        </h2>
        <div className="flex items-center gap-4">
          <p aria-live="polite" className="text-sm text-muted">
            {filtered.length.toLocaleString(numberLocale)} {t('دوره', 'courses')}
          </p>
          {activeFilters > 0 && (
            <button type="button" onClick={reset} className="flex items-center gap-1 text-sm font-bold text-purple">
              <RotateCcw size={15} aria-hidden="true" />
              {t('حذف فیلترها', 'Clear filters')}
            </button>
          )}
        </div>
      </div>

      {filtered.length ? (
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((course) => (
            <CourseCard key={course.slug} course={course} />
          ))}
        </div>
      ) : (
        <div className="review-empty mt-5">
          <BookOpen aria-hidden="true" />
          <strong>{t('دوره‌ای با این فیلترها پیدا نشد', 'No courses match these filters')}</strong>
          <p>{t('فیلترها را تغییر دهید یا همه دوره‌ها را ببینید.', 'Change the filters or return to all courses.')}</p>
          <button type="button" className="secondary-button mt-2" onClick={reset}>
            <RotateCcw size={17} aria-hidden="true" />
            {t('نمایش همه دوره‌ها', 'Show all courses')}
          </button>
        </div>
      )}
    </section>
  );
}

function Count({ value, locale }: { value: number; locale: string }) {
  return <span className="opacity-70">({value.toLocaleString(locale)})</span>;
}

function Select({
  label,
  value,
  onChange,
  allLabel,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  allLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1 text-xs font-bold text-muted">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 rounded-xl border hairline bg-white px-3 text-sm font-medium text-navy outline-none focus:border-purple"
      >
        {allLabel !== undefined && <option value="">{allLabel}</option>}
        {children}
      </select>
    </label>
  );
}

function FilterButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex min-h-10 items-center gap-1 rounded-full border px-4 py-2 text-sm font-bold ${
        active ? 'border-purple bg-purple text-white' : 'hairline bg-white hover:border-purple hover:text-purple'
      }`}
    >
      {children}
    </button>
  );
}
