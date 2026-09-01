'use client';

import { useState } from 'react';
import { BookOpen, RotateCcw } from 'lucide-react';
import { CourseCard } from '@/components/marketplace/cards';
import type { Course } from '@/lib/marketplace-data';
import { useTranslations } from '@/components/shared/locale-provider';
import { localizedCourseLanguage } from '../course-localization';

export function CourseDirectory({ courses }: { courses: Course[] }) {
  const [language, setLanguage] = useState<string>('');
  const { locale } = useTranslations();
  const english = locale === 'en';
  const languageOptions = [...new Set(courses.map((course) => course.language))];
  const filteredCourses = language ? courses.filter((course) => course.language === language) : courses;

  return (
    <section aria-labelledby="course-results-heading" className="mt-8">
      <div
        className="flex flex-wrap items-center gap-2"
        aria-label={english ? 'Filter courses by language' : 'فیلتر دوره‌ها بر اساس زبان'}
      >
        <FilterButton active={!language} onClick={() => setLanguage('')}>
          {english ? 'All courses' : 'همه دوره‌ها'}
        </FilterButton>
        {languageOptions.map((option) => (
          <FilterButton key={option} active={language === option} onClick={() => setLanguage(option)}>
            {localizedCourseLanguage(option, locale)}
          </FilterButton>
        ))}
      </div>

      <div className="mt-8 flex items-center justify-between gap-4">
        <h2 id="course-results-heading" className="text-lg font-black">
          {language
            ? english
              ? `${localizedCourseLanguage(language, locale)} courses`
              : `دوره‌های ${language}`
            : english
              ? 'All courses'
              : 'همه دوره‌ها'}
        </h2>
        <p aria-live="polite" className="text-sm text-muted">
          {filteredCourses.length.toLocaleString(english ? 'en-US' : 'fa-IR')} {english ? 'courses' : 'دوره'}
        </p>
      </div>

      {filteredCourses.length ? (
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {filteredCourses.map((course) => (
            <CourseCard key={course.slug} course={course} />
          ))}
        </div>
      ) : (
        <div className="review-empty mt-5">
          <BookOpen aria-hidden="true" />
          <strong>
            {english
              ? 'No courses have been published for this language yet'
              : 'برای این زبان هنوز دوره‌ای منتشر نشده است'}
          </strong>
          <p>
            {english
              ? 'Choose another language or return to all courses.'
              : 'زبان دیگری را انتخاب کنید یا همه دوره‌ها را ببینید.'}
          </p>
          <button className="secondary-button mt-2" onClick={() => setLanguage('')}>
            <RotateCcw size={17} aria-hidden="true" />
            {english ? 'Show all courses' : 'نمایش همه دوره‌ها'}
          </button>
        </div>
      )}
    </section>
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
      className={`min-h-11 rounded-full border px-5 py-2 text-sm font-bold ${
        active ? 'border-purple bg-purple text-white' : 'hairline bg-white hover:border-purple hover:text-purple'
      }`}
    >
      {children}
    </button>
  );
}
