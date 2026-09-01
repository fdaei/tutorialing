'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, CheckCircle2, PlayCircle } from 'lucide-react';
import { api, apiMessage } from '@/shared/services/api';
import { useTranslations } from '@/components/shared/locale-provider';
import { localePath, localized } from '@/lib/i18n';
import type { LearningEnrollment } from '../course-types';

export function MyCourses() {
  const { locale } = useTranslations(),
    english = locale === 'en',
    query = useQuery({ queryKey: ['my-courses'], queryFn: () => api<LearningEnrollment[]>('/courses/me/learning') });
  return (
    <section>
      <p className="text-sm font-black text-purple">{english ? 'Learning workspace' : 'فضای یادگیری'}</p>
      <h1 className="mt-2 text-3xl font-black">{english ? 'My courses' : 'دوره‌های من'}</h1>
      <p className="mt-2 text-sm text-muted">
        {english
          ? 'Resume exactly where you stopped and see progress at a glance.'
          : 'دقیقاً از آخرین درس ادامه دهید و پیشرفت را یک‌جا ببینید.'}
      </p>
      {query.isLoading && (
        <div className="mt-7 grid gap-5 md:grid-cols-2">
          <div className="skeleton h-64 rounded-3xl" />
          <div className="skeleton h-64 rounded-3xl" />
        </div>
      )}
      {query.isError && (
        <div role="alert" className="mt-7 rounded-2xl bg-red-50 p-5 text-red-700">
          {apiMessage(query.error, english ? 'Courses could not be loaded.' : 'دریافت دوره‌ها ناموفق بود.')}{' '}
          <button onClick={() => query.refetch()} className="font-bold underline">
            {english ? 'Try again' : 'تلاش دوباره'}
          </button>
        </div>
      )}
      {query.data && !query.data.length && (
        <div className="review-empty mt-7">
          <BookOpen />
          <strong>{english ? 'You have not enrolled in a course yet' : 'هنوز در دوره‌ای ثبت‌نام نکرده‌اید'}</strong>
          <p>
            {english
              ? 'Browse courses and choose the route that fits your level.'
              : 'دوره‌ها را ببینید و مسیر متناسب با سطح خود را انتخاب کنید.'}
          </p>
          <Link href={localePath('/courses', locale)} className="primary-button">
            {english ? 'Browse courses' : 'مشاهده دوره‌ها'}
          </Link>
        </div>
      )}
      <div className="mt-7 grid gap-5 md:grid-cols-2">
        {query.data?.map((item) => (
          <article key={item.id} className="panel-card overflow-hidden">
            <div className="relative aspect-[16/7] bg-lavender">
              {item.course.image && (
                <Image
                  src={item.course.image}
                  alt=""
                  fill
                  sizes="(min-width:768px) 45vw, 100vw"
                  className="object-cover"
                />
              )}
              <span className="absolute inset-0 bg-gradient-to-t from-navy/65 to-transparent" />
              <span className="absolute bottom-4 right-4 rounded-full bg-white/90 px-3 py-1 text-xs font-black text-purple">
                {item.course.language} · {item.course.level}
              </span>
            </div>
            <div className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black">
                    {localized({ fa: item.course.titleFa, en: item.course.titleEn }, locale)}
                  </h2>
                  <p className="mt-2 text-xs text-muted">
                    {item.lastLesson
                      ? `${english ? 'Last lesson' : 'آخرین درس'}: ${localized({ fa: item.lastLesson.titleFa, en: item.lastLesson.titleEn }, locale)}`
                      : english
                        ? 'Ready to start'
                        : 'آماده شروع'}
                  </p>
                </div>
                {item.completedAt && <CheckCircle2 className="shrink-0 text-green" />}
              </div>
              <div className="mt-5">
                <div className="mb-2 flex justify-between text-xs">
                  <span className="text-muted">{english ? 'Course progress' : 'پیشرفت دوره'}</span>
                  <b className="latin">{item.progressPercent}%</b>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full rounded-full bg-green" style={{ width: `${item.progressPercent}%` }} />
                </div>
              </div>
              <Link
                href={localePath(`/courses/${item.course.slug}/learn`, locale)}
                className="primary-button mt-5 w-full justify-center"
              >
                <PlayCircle size={18} />
                {item.progressPercent
                  ? english
                    ? 'Resume learning'
                    : 'ادامه یادگیری'
                  : english
                    ? 'Start course'
                    : 'شروع دوره'}
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
