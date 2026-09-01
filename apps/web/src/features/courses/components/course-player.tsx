'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Download,
  FileText,
  Headphones,
  ListVideo,
  LockKeyhole,
  Menu,
  PlayCircle,
  X,
} from 'lucide-react';
import { api, apiMessage } from '@/shared/services/api';
import { useTranslations } from '@/components/shared/locale-provider';
import { localePath, localized } from '@/lib/i18n';
import type { CourseLesson, CoursePlayerPayload } from '../course-types';

export function CoursePlayer({ slug }: { slug: string }) {
  const { locale } = useTranslations(),
    english = locale === 'en',
    path = (value: string) => localePath(value, locale),
    qc = useQueryClient();
  const [selected, setSelected] = useState(''),
    [outline, setOutline] = useState(false),
    [notice, setNotice] = useState('');
  const query = useQuery({
    queryKey: ['course-player', slug],
    queryFn: () => api<CoursePlayerPayload>(`/courses/${slug}/player`),
    retry: false,
  });
  const lessons = useMemo(() => query.data?.course.chapters.flatMap((chapter) => chapter.lessons) ?? [], [query.data]);
  const current =
    lessons.find((item) => item.id === selected) ||
    lessons.find((item) => item.id === query.data?.lastLessonId) ||
    lessons[0];
  useEffect(() => {
    if (current && !selected) setSelected(current.id);
  }, [current, selected]);
  const completed = new Set(query.data?.progress.filter((item) => item.completedAt).map((item) => item.lessonId));
  const save = useMutation({
    mutationFn: (input: { lessonId: string; completed?: boolean; positionSeconds?: number }) =>
      api(`/courses/${slug}/lessons/${input.lessonId}/progress`, {
        method: 'PATCH',
        body: JSON.stringify({ completed: input.completed, positionSeconds: input.positionSeconds }),
      }),
    onSuccess: () => {
      setNotice(english ? 'Progress saved' : 'پیشرفت ذخیره شد');
      void qc.invalidateQueries({ queryKey: ['course-player', slug] });
      void qc.invalidateQueries({ queryKey: ['my-courses'] });
    },
    onError: (error) =>
      setNotice(apiMessage(error, english ? 'Progress could not be saved.' : 'ذخیره پیشرفت ناموفق بود.')),
  });
  if (query.isLoading) return <PlayerSkeleton />;
  if (query.isError)
    return (
      <main className="grid min-h-screen place-items-center bg-[#0f1435] p-6 text-center text-white">
        <div>
          <LockKeyhole className="mx-auto text-violet" size={42} />
          <h1 className="mt-5 text-2xl font-black">
            {english ? 'This course is not available in your account' : 'این دوره در حساب شما فعال نیست'}
          </h1>
          <p className="mt-3 text-white/60">
            {english
              ? 'Enroll or sign in with the account that purchased it.'
              : 'در دوره ثبت‌نام کنید یا با حساب خریدار وارد شوید.'}
          </p>
          <Link
            href={path(`/courses/${slug}`)}
            className="mt-6 inline-flex rounded-xl bg-white px-6 py-3 font-black text-purple"
          >
            {english ? 'Back to course' : 'بازگشت به دوره'}
          </Link>
        </div>
      </main>
    );
  if (!query.data || !current)
    return (
      <main className="grid min-h-screen place-items-center bg-[#0f1435] text-white">
        {english ? 'No published lessons yet.' : 'هنوز درسی منتشر نشده است.'}
      </main>
    );
  const index = lessons.findIndex((item) => item.id === current.id),
    previous = lessons[index - 1],
    next = lessons[index + 1];
  function choose(id: string) {
    setSelected(id);
    setOutline(false);
    save.mutate({ lessonId: id });
  }
  return (
    <div className="course-player-shell" dir={english ? 'ltr' : 'rtl'}>
      <header className="course-player-header">
        <Link
          href={path(`/courses/${slug}`)}
          className="flex items-center gap-2 text-sm text-white/65 hover:text-white"
        >
          {english ? <ArrowLeft size={18} /> : <ArrowRight size={18} />}
          <span className="hidden sm:inline">{english ? 'Course details' : 'جزئیات دوره'}</span>
        </Link>
        <div className="min-w-0 flex-1 text-center">
          <strong className="block truncate text-sm text-white">
            {localized({ fa: query.data.course.titleFa, en: query.data.course.titleEn }, locale)}
          </strong>
          <div className="mx-auto mt-2 h-1.5 max-w-xs overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full bg-emerald-400" style={{ width: `${query.data.progressPercent}%` }} />
          </div>
        </div>
        <span className="latin text-xs font-black text-emerald-300">{query.data.progressPercent}%</span>
        <button
          className="grid size-10 place-items-center rounded-xl bg-white/10 lg:hidden"
          onClick={() => setOutline(true)}
          aria-label={english ? 'Open curriculum' : 'بازکردن سرفصل‌ها'}
        >
          <Menu />
        </button>
      </header>
      <aside className={`course-player-outline ${outline ? 'course-player-outline-open' : ''}`}>
        <div className="flex items-center justify-between border-b border-white/10 p-5">
          <div>
            <p className="text-xs text-white/45">{english ? 'Course route' : 'مسیر دوره'}</p>
            <strong className="mt-1 block text-white">
              {query.data.completedLessons.toLocaleString(english ? 'en-US' : 'fa-IR')} /{' '}
              {query.data.totalLessons.toLocaleString(english ? 'en-US' : 'fa-IR')} {english ? 'lessons' : 'درس'}
            </strong>
          </div>
          <button onClick={() => setOutline(false)} className="lg:hidden" aria-label={english ? 'Close' : 'بستن'}>
            <X />
          </button>
        </div>
        <nav className="course-player-rail">
          {query.data.course.chapters.map((chapter, chapterIndex) => (
            <details open key={chapter.id}>
              <summary>
                <span>{(chapterIndex + 1).toLocaleString(english ? 'en-US' : 'fa-IR')}</span>
                <strong>{localized({ fa: chapter.titleFa, en: chapter.titleEn }, locale)}</strong>
                <ChevronDown size={16} />
              </summary>
              <div>
                {chapter.lessons.map((lesson) => (
                  <button
                    key={lesson.id}
                    onClick={() => choose(lesson.id)}
                    className={lesson.id === current.id ? 'active' : ''}
                  >
                    <span className={completed.has(lesson.id) ? 'done' : ''}>
                      {completed.has(lesson.id) ? <Check size={14} /> : lessonIcon(lesson.type)}
                    </span>
                    <span>
                      <strong>{localized({ fa: lesson.titleFa, en: lesson.titleEn }, locale)}</strong>
                      <small>{duration(lesson.durationSeconds, english)}</small>
                    </span>
                  </button>
                ))}
              </div>
            </details>
          ))}
        </nav>
      </aside>
      {outline && (
        <button
          aria-label={english ? 'Close curriculum' : 'بستن سرفصل‌ها'}
          onClick={() => setOutline(false)}
          className="fixed inset-0 z-30 bg-black/45 lg:hidden"
        />
      )}
      <main className="course-player-main">
        <div className="mx-auto w-full max-w-5xl">
          <div className="course-player-stage">
            <LessonContent
              lesson={current}
              english={english}
              onPosition={(positionSeconds) => save.mutate({ lessonId: current.id, positionSeconds })}
            />
          </div>
          <div className="p-5 md:p-8">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div>
                <p className="text-xs font-black text-purple">
                  {english
                    ? `Lesson ${index + 1} of ${lessons.length}`
                    : `درس ${(index + 1).toLocaleString('fa-IR')} از ${lessons.length.toLocaleString('fa-IR')}`}
                </p>
                <h1 className="mt-2 text-2xl font-black md:text-3xl">
                  {localized({ fa: current.titleFa, en: current.titleEn }, locale)}
                </h1>
                <p className="mt-3 max-w-3xl leading-8 text-muted">
                  {localized({ fa: current.descriptionFa, en: current.descriptionEn }, locale)}
                </p>
              </div>
              <button
                disabled={save.isPending}
                onClick={() =>
                  save.mutate({
                    lessonId: current.id,
                    completed: !completed.has(current.id),
                    positionSeconds: current.durationSeconds,
                  })
                }
                className={completed.has(current.id) ? 'secondary-button text-green' : 'primary-button'}
              >
                {completed.has(current.id) ? (
                  <>
                    <CheckCircle2 size={18} />
                    {english ? 'Completed' : 'تکمیل‌شده'}
                  </>
                ) : (
                  <>
                    <Check size={18} />
                    {english ? 'Mark complete' : 'تکمیل درس'}
                  </>
                )}
              </button>
            </div>
            {notice && (
              <p aria-live="polite" className="mt-4 text-sm text-purple">
                {notice}
              </p>
            )}
            {current.attachments.length > 0 && (
              <section className="mt-8 border-t hairline pt-6">
                <h2 className="font-black">{english ? 'Lesson files' : 'فایل‌های درس'}</h2>
                <div className="mt-4 flex flex-wrap gap-3">
                  {current.attachments.map((file) => (
                    <a href={file.url} target="_blank" rel="noreferrer" key={file.id} className="secondary-button">
                      <Download size={17} />
                      {file.title}
                    </a>
                  ))}
                </div>
              </section>
            )}
            <div className="mt-10 flex items-center justify-between border-t hairline pt-6">
              <button
                disabled={!previous}
                onClick={() => previous && choose(previous.id)}
                className="secondary-button disabled:opacity-35"
              >
                {english ? <ArrowLeft size={17} /> : <ArrowRight size={17} />} {english ? 'Previous' : 'درس قبلی'}
              </button>
              <button
                disabled={!next}
                onClick={() => next && choose(next.id)}
                className="primary-button disabled:opacity-35"
              >
                {english ? 'Next' : 'درس بعدی'} {english ? <ArrowRight size={17} /> : <ArrowLeft size={17} />}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function LessonContent({
  lesson,
  english,
  onPosition,
}: {
  lesson: CourseLesson;
  english: boolean;
  onPosition: (seconds: number) => void;
}) {
  const content = lesson.content as { fa?: string; en?: string; question?: string; options?: string[] } | undefined;
  if (lesson.type === 'VIDEO' && lesson.mediaUrl)
    return (
      <video
        controls
        className="h-full w-full"
        src={lesson.mediaUrl}
        onPause={(event) => onPosition(Math.floor(event.currentTarget.currentTime))}
      />
    );
  if (lesson.type === 'AUDIO')
    return (
      <div className="grid min-h-[380px] place-items-center p-8 text-center text-white">
        <div>
          <Headphones className="mx-auto text-violet" size={64} />
          <h2 className="mt-5 text-2xl font-black">{english ? 'Listen and repeat' : 'گوش کنید و تکرار کنید'}</h2>
          {lesson.mediaUrl && (
            <audio
              controls
              src={lesson.mediaUrl}
              className="mt-6 w-full"
              onPause={(event) => onPosition(Math.floor(event.currentTarget.currentTime))}
            />
          )}
        </div>
      </div>
    );
  if (lesson.type === 'QUIZ')
    return (
      <div className="mx-auto max-w-2xl p-8 text-white">
        <p className="text-sm text-violet">{english ? 'Practice' : 'تمرین'}</p>
        <h2 className="mt-3 text-2xl font-black">
          {content?.question ?? (english ? 'Complete the exercise' : 'تمرین درس را انجام دهید')}
        </h2>
        <div className="mt-6 grid gap-3">
          {content?.options?.map((option) => (
            <button key={option} className="rounded-xl border border-white/15 p-4 text-start hover:bg-white/10">
              {option}
            </button>
          ))}
        </div>
      </div>
    );
  return (
    <article className="mx-auto max-w-3xl p-8 text-white md:p-12">
      <FileText className="text-violet" />
      <div className="mt-6 whitespace-pre-wrap text-lg leading-9 text-white/85">
        {(english ? content?.en : content?.fa) ??
          (english ? 'Lesson text is being prepared.' : 'متن درس در حال آماده‌سازی است.')}
      </div>
    </article>
  );
}
function lessonIcon(type: CourseLesson['type']) {
  return type === 'VIDEO' ? (
    <PlayCircle size={14} />
  ) : type === 'AUDIO' ? (
    <Headphones size={14} />
  ) : type === 'TEXT' ? (
    <FileText size={14} />
  ) : (
    <ListVideo size={14} />
  );
}
function duration(seconds: number, english: boolean) {
  if (!seconds) return english ? 'Reading' : 'مطالعه';
  return `${Math.max(1, Math.round(seconds / 60)).toLocaleString(english ? 'en-US' : 'fa-IR')} ${english ? 'min' : 'دقیقه'}`;
}
function PlayerSkeleton() {
  return (
    <div className="min-h-screen bg-[#0f1435] p-6">
      <div className="skeleton h-14 rounded-2xl" />
      <div className="mx-auto mt-6 max-w-5xl">
        <div className="skeleton aspect-video rounded-3xl" />
        <div className="skeleton mt-5 h-32 rounded-2xl" />
      </div>
    </div>
  );
}
