'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, ChevronDown, CirclePlus, FileText, Headphones, Play, Trash2, Video } from 'lucide-react';
import { api, apiMessage } from '@/shared/services/api';
import type { CourseChapter, CourseLesson, InstructorCourse, InstructorCurriculum, LessonType } from '../course-types';

const lessonIcons = { VIDEO: Video, AUDIO: Headphones, TEXT: FileText, QUIZ: CirclePlus };
const lessonLabels = { VIDEO: 'ویدئو', AUDIO: 'صوت', TEXT: 'متن', QUIZ: 'تمرین' };
type ChapterInput = { titleFa: string; titleEn: string; order: number; published: boolean };
type LessonInput = {
  titleFa: string;
  titleEn: string;
  descriptionFa?: string;
  descriptionEn?: string;
  type: LessonType;
  content?: Record<string, unknown>;
  mediaUrl?: string;
  durationSeconds: number;
  order: number;
  preview: boolean;
  published: boolean;
};

const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });
const nextOrder = <T extends { order: number }>(rows: T[]) => Math.max(0, ...rows.map((row) => row.order)) + 1;
const chapterInput = (item: CourseChapter, published = Boolean(item.published)): ChapterInput => ({
  titleFa: item.titleFa,
  titleEn: item.titleEn,
  order: item.order,
  published,
});
const contentObject = (content: unknown) =>
  content && typeof content === 'object' && !Array.isArray(content) ? (content as Record<string, unknown>) : {};
const lessonInput = (item: CourseLesson, published = Boolean(item.published)): LessonInput => ({
  titleFa: item.titleFa,
  titleEn: item.titleEn,
  descriptionFa: item.descriptionFa,
  descriptionEn: item.descriptionEn,
  type: item.type,
  content: contentObject(item.content),
  mediaUrl: item.mediaUrl,
  durationSeconds: item.durationSeconds,
  order: item.order,
  preview: Boolean(item.preview),
  published,
});

export function InstructorCourseWorkspace() {
  const qc = useQueryClient();
  const courses = useQuery({
    queryKey: ['instructor-courses'],
    queryFn: () => api<InstructorCourse[]>('/instructor/courses'),
  });
  const [courseId, setCourseId] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (!courseId && courses.data?.[0]) setCourseId(courses.data[0].id);
  }, [courseId, courses.data]);
  const curriculum = useQuery({
    queryKey: ['instructor-curriculum', courseId],
    queryFn: () => api<InstructorCurriculum>(`/instructor/courses/${courseId}/curriculum`),
    enabled: Boolean(courseId),
  });
  const changed = () => {
    setNotice('تغییرات ذخیره شد.');
    return qc.invalidateQueries({ queryKey: ['instructor-curriculum', courseId] });
  };
  const failed = (fallback: string) => (error: unknown) => setNotice(apiMessage(error, fallback));
  const chapter = useMutation({
    mutationFn: (body: ChapterInput) => api(`/instructor/courses/${courseId}/chapters`, json('POST', body)),
    onSuccess: changed,
    onError: failed('ساخت فصل ناموفق بود.'),
  });
  const lesson = useMutation({
    mutationFn: ({ chapterId, body }: { chapterId: string; body: LessonInput }) =>
      api(`/instructor/courses/${courseId}/chapters/${chapterId}/lessons`, json('POST', body)),
    onSuccess: changed,
    onError: failed('ساخت درس ناموفق بود.'),
  });
  const toggleChapter = useMutation({
    mutationFn: (item: CourseChapter) =>
      api(`/instructor/courses/${courseId}/chapters/${item.id}`, json('PATCH', chapterInput(item, !item.published))),
    onSuccess: changed,
    onError: failed('تغییر وضعیت فصل ناموفق بود.'),
  });
  const toggleLesson = useMutation({
    mutationFn: (item: CourseLesson) =>
      api(`/instructor/courses/${courseId}/lessons/${item.id}`, json('PATCH', lessonInput(item, !item.published))),
    onSuccess: changed,
    onError: failed('تغییر وضعیت درس ناموفق بود.'),
  });
  const remove = useMutation({
    mutationFn: ({ kind, id }: { kind: 'chapters' | 'lessons'; id: string }) =>
      api(`/instructor/courses/${courseId}/${kind}/${id}`, { method: 'DELETE' }),
    onSuccess: changed,
    onError: failed('حذف محتوا ناموفق بود.'),
  });

  if (courses.isLoading) return <WorkspaceSkeleton />;
  if (courses.isError)
    return <WorkspaceError message="دریافت دوره‌های مدرس ناموفق بود." retry={() => void courses.refetch()} />;
  if (!courses.data?.length)
    return (
      <WorkspaceEmpty
        title="هنوز دوره‌ای به شما اختصاص داده نشده است"
        description="پس از ایجاد و تخصیص دوره توسط مدیر، مدیریت محتوای آن در این بخش فعال می‌شود."
      />
    );
  const busy =
    chapter.isPending || lesson.isPending || toggleChapter.isPending || toggleLesson.isPending || remove.isPending;

  return (
    <section className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-black text-purple">استودیوی آموزش</p>
          <h1 className="mt-2 text-3xl font-black">مدیریت محتوای دوره</h1>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-muted">
            فصل‌ها و درس‌ها را در حالت پیش‌نویس بسازید و فقط محتوای آماده را منتشر کنید.
          </p>
        </div>
        <label className="grid min-w-64 gap-2 text-sm font-bold">
          دوره
          <select
            className="input"
            value={courseId}
            onChange={(event) => {
              setNotice('');
              setCourseId(event.target.value);
            }}
          >
            {courses.data.map((course) => (
              <option key={course.id} value={course.id}>
                {course.titleFa}
              </option>
            ))}
          </select>
        </label>
      </div>
      {notice && (
        <p role="status" className="rounded-xl border hairline bg-white px-4 py-3 text-sm">
          {notice}
        </p>
      )}
      {curriculum.isLoading ? (
        <WorkspaceSkeleton compact />
      ) : curriculum.isError ? (
        <WorkspaceError message="دریافت سرفصل دوره ناموفق بود." retry={() => void curriculum.refetch()} />
      ) : curriculum.data ? (
        <>
          <CourseSummary course={curriculum.data} />
          <ChapterCreator
            order={nextOrder(curriculum.data.chapters)}
            pending={chapter.isPending}
            onCreate={(body) => chapter.mutate(body)}
          />
          <div className="grid gap-4">
            {!curriculum.data.chapters.length ? (
              <WorkspaceEmpty
                title="سرفصل دوره خالی است"
                description="اولین فصل را بسازید؛ درس‌ها درون هر فصل اضافه می‌شوند."
              />
            ) : (
              curriculum.data.chapters.map((item) => (
                <ChapterCard
                  key={item.id}
                  chapter={item}
                  busy={busy}
                  onToggle={() => toggleChapter.mutate(item)}
                  onAdd={(body) => lesson.mutate({ chapterId: item.id, body })}
                  onToggleLesson={(row) => toggleLesson.mutate(row)}
                  onDeleteLesson={(id) =>
                    window.confirm('این درس و پیشرفت مرتبط حذف شود؟') && remove.mutate({ kind: 'lessons', id })
                  }
                  onDelete={() =>
                    window.confirm('این فصل و همه درس‌های آن حذف شود؟') &&
                    remove.mutate({ kind: 'chapters', id: item.id })
                  }
                />
              ))
            )}
          </div>
        </>
      ) : null}
    </section>
  );
}

function CourseSummary({ course }: { course: InstructorCurriculum }) {
  const lessons = course.chapters.reduce((count, row) => count + row.lessons.length, 0);
  return (
    <div className="panel-card grid gap-4 p-5 sm:grid-cols-3">
      <Summary label="وضعیت دوره" value={course.published ? 'منتشرشده' : 'پیش‌نویس'} />
      <Summary label="فصل‌ها" value={String(course.chapters.length)} />
      <Summary label="درس‌های ساخته‌شده" value={String(lessons)} />
    </div>
  );
}
function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-lg font-black">{value}</p>
    </div>
  );
}

function ChapterCreator({
  order,
  pending,
  onCreate,
}: {
  order: number;
  pending: boolean;
  onCreate: (body: ChapterInput) => void;
}) {
  const [open, setOpen] = useState(false);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget,
      data = new FormData(form);
    onCreate({
      titleFa: String(data.get('titleFa')),
      titleEn: String(data.get('titleEn')),
      order: Number(data.get('order')),
      published: false,
    });
    form.reset();
    setOpen(false);
  }
  return (
    <div className="panel-card p-5">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-3 text-start font-black"
      >
        <span className="flex items-center gap-2">
          <CirclePlus className="text-purple" />
          افزودن فصل
        </span>
        <ChevronDown className={open ? 'rotate-180 transition' : 'transition'} />
      </button>
      {open && (
        <form onSubmit={submit} className="mt-5 grid gap-4 md:grid-cols-3">
          <Field name="titleFa" label="عنوان فارسی" />
          <Field name="titleEn" label="عنوان انگلیسی" dir="ltr" />
          <Field name="order" label="ترتیب" type="number" defaultValue={String(order)} />
          <button disabled={pending} className="primary-button justify-center md:col-span-3">
            {pending ? 'در حال ساخت...' : 'ساخت فصل پیش‌نویس'}
          </button>
        </form>
      )}
    </div>
  );
}

function ChapterCard({
  chapter,
  busy,
  onToggle,
  onAdd,
  onToggleLesson,
  onDeleteLesson,
  onDelete,
}: {
  chapter: CourseChapter;
  busy: boolean;
  onToggle: () => void;
  onAdd: (body: LessonInput) => void;
  onToggleLesson: (lesson: CourseLesson) => void;
  onDeleteLesson: (id: string) => void;
  onDelete: () => void;
}) {
  return (
    <article className="panel-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b hairline p-5">
        <div>
          <div className="flex items-center gap-3">
            <BookOpen className="text-purple" />
            <h2 className="text-lg font-black">
              {chapter.order}. {chapter.titleFa}
            </h2>
            <Status published={Boolean(chapter.published)} />
          </div>
          <p className="mt-1 text-xs text-muted" dir="ltr">
            {chapter.titleEn}
          </p>
        </div>
        <div className="flex gap-2">
          <button disabled={busy} onClick={onToggle} className="secondary-button">
            {chapter.published ? 'بازگردانی به پیش‌نویس' : 'انتشار فصل'}
          </button>
          <DeleteButton label="حذف فصل" disabled={busy} onClick={onDelete} />
        </div>
      </div>
      <div className="grid gap-3 p-5">
        {chapter.lessons.map((item) => (
          <LessonRow
            key={item.id}
            lesson={item}
            busy={busy}
            onToggle={() => onToggleLesson(item)}
            onDelete={() => onDeleteLesson(item.id)}
          />
        ))}
        {!chapter.lessons.length && (
          <p className="rounded-xl border border-dashed hairline p-6 text-center text-sm text-muted">
            هنوز درسی در این فصل نیست.
          </p>
        )}
        <LessonCreator order={nextOrder(chapter.lessons)} pending={busy} onCreate={onAdd} />
      </div>
    </article>
  );
}
function LessonRow({
  lesson,
  busy,
  onToggle,
  onDelete,
}: {
  lesson: CourseLesson;
  busy: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const Icon = lessonIcons[lesson.type];
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-canvas p-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-purple">
          <Icon size={18} />
        </span>
        <div className="min-w-0">
          <p className="truncate font-bold">
            {lesson.order}. {lesson.titleFa}
          </p>
          <p className="mt-1 text-xs text-muted">
            {lessonLabels[lesson.type]} · {Math.ceil(lesson.durationSeconds / 60)} دقیقه{' '}
            {lesson.preview ? '· پیش‌نمایش رایگان' : ''}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Status published={Boolean(lesson.published)} />
        <button disabled={busy} onClick={onToggle} className="secondary-button">
          {lesson.published ? 'عدم انتشار' : 'انتشار'}
        </button>
        <DeleteButton label="حذف درس" disabled={busy} onClick={onDelete} />
      </div>
    </div>
  );
}
function Status({ published }: { published: boolean }) {
  return (
    <span className={`status-pill ${published ? 'status-success' : 'status-warning'}`}>
      {published ? 'منتشر' : 'پیش‌نویس'}
    </span>
  );
}
function DeleteButton({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="grid size-9 place-items-center rounded-xl text-red-600"
      aria-label={label}
    >
      <Trash2 size={16} />
    </button>
  );
}

function LessonCreator({
  order,
  pending,
  onCreate,
}: {
  order: number;
  pending: boolean;
  onCreate: (body: LessonInput) => void;
}) {
  const [open, setOpen] = useState(false);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget,
      data = new FormData(form),
      type = String(data.get('type')) as LessonType,
      fa = String(data.get('contentFa') ?? '').trim(),
      en = String(data.get('contentEn') ?? '').trim(),
      media = String(data.get('mediaUrl') ?? '').trim();
    onCreate({
      titleFa: String(data.get('titleFa')),
      titleEn: String(data.get('titleEn')),
      descriptionFa: String(data.get('descriptionFa') ?? '') || undefined,
      descriptionEn: String(data.get('descriptionEn') ?? '') || undefined,
      type,
      content: fa || en ? { fa, en } : undefined,
      mediaUrl: media || undefined,
      durationSeconds: Number(data.get('durationMinutes')) * 60,
      order: Number(data.get('order')),
      preview: data.get('preview') === 'on',
      published: false,
    });
    form.reset();
    setOpen(false);
  }
  return (
    <div className="rounded-2xl border border-dashed hairline p-4">
      <button
        type="button"
        className="flex w-full items-center gap-2 font-bold text-purple"
        onClick={() => setOpen(!open)}
      >
        <CirclePlus size={18} />
        افزودن درس
      </button>
      {open && (
        <form onSubmit={submit} className="mt-5 grid gap-4 md:grid-cols-2">
          <Field name="titleFa" label="عنوان فارسی" />
          <Field name="titleEn" label="عنوان انگلیسی" dir="ltr" />
          <Field name="descriptionFa" label="توضیح کوتاه فارسی" optional />
          <Field name="descriptionEn" label="توضیح کوتاه انگلیسی" dir="ltr" optional />
          <label className="grid gap-2 text-sm font-bold">
            نوع درس
            <select name="type" className="input">
              <option value="VIDEO">ویدئو</option>
              <option value="AUDIO">صوت</option>
              <option value="TEXT">متن</option>
              <option value="QUIZ">تمرین</option>
            </select>
          </label>
          <Field name="mediaUrl" label="نشانی فایل رسانه" dir="ltr" optional type="url" />
          <Field name="durationMinutes" label="مدت (دقیقه)" type="number" defaultValue="10" />
          <Field name="order" label="ترتیب" type="number" defaultValue={String(order)} />
          <div className="md:col-span-2">
            <Field name="contentFa" label="محتوای فارسی / سؤال تمرین" area optional />
          </div>
          <div className="md:col-span-2">
            <Field name="contentEn" label="محتوای انگلیسی" area dir="ltr" optional />
          </div>
          <label className="flex items-center gap-2 text-sm font-bold">
            <input name="preview" type="checkbox" />
            پیش‌نمایش رایگان
          </label>
          <button disabled={pending} className="primary-button justify-center md:col-span-2">
            <Play size={17} />
            {pending ? 'در حال ساخت...' : 'ساخت درس پیش‌نویس'}
          </button>
        </form>
      )}
    </div>
  );
}

function Field({
  name,
  label,
  dir,
  type = 'text',
  defaultValue,
  optional,
  area,
}: {
  name: string;
  label: string;
  dir?: 'ltr';
  type?: string;
  defaultValue?: string;
  optional?: boolean;
  area?: boolean;
}) {
  return (
    <label className="grid gap-2 text-sm font-bold">
      {label}
      {area ? (
        <textarea className="input resize-y" rows={4} name={name} dir={dir} required={!optional} />
      ) : (
        <input
          className="input"
          name={name}
          dir={dir}
          type={type}
          defaultValue={defaultValue}
          min={type === 'number' ? 1 : undefined}
          required={!optional}
        />
      )}
    </label>
  );
}
function WorkspaceSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className="grid gap-4" aria-label="در حال دریافت">
      <div className={`skeleton rounded-2xl ${compact ? 'h-32' : 'h-44'}`} />
      <div className="skeleton h-64 rounded-2xl" />
    </div>
  );
}
function WorkspaceError({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div role="alert" className="rounded-2xl bg-red-50 p-6 text-red-700">
      {message}{' '}
      <button onClick={retry} className="font-bold underline">
        تلاش دوباره
      </button>
    </div>
  );
}
function WorkspaceEmpty({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed hairline p-10 text-center">
      <BookOpen className="mx-auto text-purple" />
      <h2 className="mt-4 font-black">{title}</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-7 text-muted">{description}</p>
    </div>
  );
}
