'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  CheckCircle2,
  CircleDot,
  ExternalLink,
  Filter,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Users,
  X,
} from 'lucide-react';
import { useTranslations } from '@/components/shared/locale-provider';
import { localePath, isDefaultLocale } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import { api, apiMessage } from '@/shared/services/api';

type CourseFormat = 'SELF_PACED' | 'LIVE_ONLINE';
type CoursePackage = {
  id: string;
  titleFa: string;
  titleEn: string;
  credits: number;
  active: boolean;
  course: { id: string } | null;
};
type CourseInstructor = {
  id: string;
  nameFa: string;
  nameEn: string;
  slug: string;
  packages?: CoursePackage[];
};
type AdminCourse = {
  id: string;
  slug: string;
  titleFa: string;
  titleEn: string;
  descriptionFa: string;
  descriptionEn: string;
  language: string;
  level: string;
  teacherId?: string | null;
  teacherName: string;
  format?: CourseFormat | null;
  packageId?: string | null;
  teacher?: { id: string; nameFa: string; nameEn: string; status: string } | null;
  lessonsCount: number;
  price: number;
  image?: string | null;
  published: boolean;
  rating: number;
  reviewsCount: number;
  updatedAt: string;
  _count: { chapters: number; enrollments: number };
};
type CourseForm = {
  slug: string;
  titleFa: string;
  titleEn: string;
  descriptionFa: string;
  descriptionEn: string;
  language: string;
  level: string;
  teacherId: string;
  format: CourseFormat;
  packageId: string;
  price: number;
  image: string;
  published: boolean;
};

const emptyForm: CourseForm = {
  slug: '',
  titleFa: '',
  titleEn: '',
  descriptionFa: '',
  descriptionEn: '',
  language: '',
  level: 'A1',
  teacherId: '',
  format: 'SELF_PACED',
  packageId: '',
  price: 0,
  image: '',
  published: false,
};
const inputClass =
  'w-full rounded-xl border border-[#dce1ee] bg-white px-3.5 py-3 outline-none transition focus:border-purple focus:ring-4 focus:ring-violet/10';
// Suggestions only. The catalog also sells levels like `IELTS` and `All levels`,
// so the field stays free text and must never coerce an unknown value.
const levelSuggestions = ['A1', 'A2', 'A1–C1', 'B1', 'B2', 'C1', 'C2', 'IELTS', 'All levels'];

function formOf(course: AdminCourse): CourseForm {
  return {
    slug: course.slug,
    titleFa: course.titleFa,
    titleEn: course.titleEn,
    descriptionFa: course.descriptionFa,
    descriptionEn: course.descriptionEn,
    language: course.language,
    level: course.level,
    teacherId: course.teacherId ?? '',
    format: course.format ?? 'SELF_PACED',
    packageId: course.packageId ?? '',
    price: course.price,
    image: course.image ?? '',
    published: course.published,
  };
}

function displayName(course: AdminCourse, fa: boolean) {
  return fa ? course.titleFa : course.titleEn;
}

function instructorName(instructor: CourseInstructor, fa: boolean) {
  return fa ? instructor.nameFa : instructor.nameEn;
}

export function AdminCourseManager() {
  const { locale } = useTranslations();
  const fa = isDefaultLocale(locale);
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<AdminCourse | null>(null);
  const [form, setForm] = useState<CourseForm>(emptyForm);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'published' | 'draft'>('all');
  const [notice, setNotice] = useState('');

  const courses = useQuery({
    queryKey: ['admin-courses'],
    queryFn: () => api<AdminCourse[]>('/admin/courses'),
  });
  const instructors = useQuery({
    queryKey: ['admin-course-instructors'],
    queryFn: () => api<CourseInstructor[]>('/admin/courses/instructors'),
  });
  const save = useMutation({
    mutationFn: async (payload: CourseForm) => {
      const body = {
        slug: payload.slug.trim(),
        titleFa: payload.titleFa.trim(),
        titleEn: payload.titleEn.trim(),
        descriptionFa: payload.descriptionFa.trim(),
        descriptionEn: payload.descriptionEn.trim(),
        language: payload.language.trim(),
        level: payload.level.trim(),
        teacherId: payload.teacherId || undefined,
        // Always sent: the API defaults a missing `format` to SELF_PACED, which
        // would silently unlink a live course's package and reject the save.
        format: payload.format,
        packageId: payload.format === 'LIVE_ONLINE' ? payload.packageId || undefined : undefined,
        price: Number(payload.price),
        image: payload.image.trim() || undefined,
        published: payload.published,
      };
      return api<AdminCourse>(editing ? `/admin/courses/${editing.id}` : '/admin/courses', {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify(body),
      });
    },
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ['admin-courses'] });
      setEditing(saved);
      setForm(formOf(saved));
      setNotice(fa ? 'تغییرات دوره ذخیره شد.' : 'Course changes saved.');
    },
  });

  const filteredCourses = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase();
    return (courses.data ?? []).filter((course) => {
      const matchesStatus = status === 'all' || (status === 'published' ? course.published : !course.published);
      const matchesSearch =
        !normalized ||
        [course.titleFa, course.titleEn, course.slug, course.language, course.teacherName]
          .join(' ')
          .toLocaleLowerCase()
          .includes(normalized);
      return matchesStatus && matchesSearch;
    });
  }, [courses.data, search, status]);

  const teacherPackages = useMemo(() => {
    const teacher = (instructors.data ?? []).find((entry) => entry.id === form.teacherId);
    return (teacher?.packages ?? []).filter(
      // A package can back only one course, so hide ones already taken by another.
      (pkg) => (pkg.active || pkg.id === form.packageId) && (!pkg.course || pkg.course.id === editing?.id),
    );
  }, [instructors.data, form.teacherId, form.packageId, editing?.id]);

  const publishedCount = courses.data?.filter((course) => course.published).length ?? 0;
  const draftCount = (courses.data?.length ?? 0) - publishedCount;

  function startNew() {
    setEditing(null);
    setForm(emptyForm);
    setNotice('');
    save.reset();
  }

  function startEdit(course: AdminCourse) {
    setEditing(course);
    setForm(formOf(course));
    setNotice('');
    save.reset();
  }

  function update<K extends keyof CourseForm>(key: K, value: CourseForm[K]) {
    setForm((current) => {
      const next = { ...current, [key]: value };
      // A package belongs to one instructor, so switching instructor (or leaving
      // the live format) drops a selection the API would reject anyway.
      if (key === 'teacherId' || (key === 'format' && value !== 'LIVE_ONLINE')) next.packageId = '';
      return next;
    });
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice('');
    save.mutate(form);
  }

  return (
    <section className="grid gap-6">
      <header className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-black text-purple">{fa ? 'کاتالوگ آموزشی' : 'Learning catalog'}</p>
          <h1 className="mt-2 text-3xl font-black">{fa ? 'مدیریت دوره‌ها' : 'Course management'}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-muted">
            {fa
              ? 'دوره‌های قابل نمایش سایت را بسازید، مدرس آن‌ها را تعیین کنید و وضعیت انتشارشان را کنترل کنید.'
              : 'Create the courses shown on the site, assign instructors, and control their publication status.'}
          </p>
        </div>
        <button type="button" onClick={startNew} className="primary-button self-start">
          <Plus size={17} />
          {fa ? 'دوره جدید' : 'New course'}
        </button>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          icon={BookOpen}
          label={fa ? 'کل دوره‌ها' : 'All courses'}
          value={courses.data?.length ?? 0}
          loading={courses.isLoading}
        />
        <Stat
          icon={CheckCircle2}
          label={fa ? 'منتشرشده' : 'Published'}
          value={publishedCount}
          tone="text-emerald-600"
          loading={courses.isLoading}
        />
        <Stat
          icon={CircleDot}
          label={fa ? 'پیش‌نویس' : 'Drafts'}
          value={draftCount}
          tone="text-orange-500"
          loading={courses.isLoading}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_430px]">
        <section className="panel-card overflow-hidden">
          <div className="flex flex-col gap-3 border-b hairline p-4 md:flex-row md:items-center">
            <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border hairline bg-[#fafbfe] px-4">
              <Search size={18} className="shrink-0 text-muted" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full bg-transparent py-3 outline-none"
                placeholder={fa ? 'جست‌وجوی عنوان، slug یا مدرس' : 'Search title, slug, or instructor'}
                aria-label={fa ? 'جست‌وجوی دوره‌ها' : 'Search courses'}
              />
            </label>
            <label className="flex items-center gap-2 rounded-xl border hairline bg-white px-3">
              <Filter size={16} className="text-muted" />
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as typeof status)}
                className="bg-transparent py-3 text-sm font-bold outline-none"
                aria-label={fa ? 'فیلتر وضعیت دوره' : 'Filter course status'}
              >
                <option value="all">{fa ? 'همه وضعیت‌ها' : 'All statuses'}</option>
                <option value="published">{fa ? 'منتشرشده' : 'Published'}</option>
                <option value="draft">{fa ? 'پیش‌نویس' : 'Draft'}</option>
              </select>
            </label>
            <button
              type="button"
              onClick={() => void courses.refetch()}
              disabled={courses.isFetching}
              className="secondary-button justify-center"
              title={fa ? 'به‌روزرسانی فهرست' : 'Refresh course list'}
              aria-label={fa ? 'به‌روزرسانی فهرست' : 'Refresh course list'}
            >
              <RefreshCw size={16} className={courses.isFetching ? 'animate-spin' : ''} />
            </button>
          </div>

          {courses.isLoading ? (
            <div className="grid gap-3 p-5">
              <div className="skeleton h-20 rounded-xl" />
              <div className="skeleton h-20 rounded-xl" />
              <div className="skeleton h-20 rounded-xl" />
            </div>
          ) : courses.isError ? (
            <div role="alert" className="m-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
              <p>{apiMessage(courses.error, fa ? 'فهرست دوره‌ها دریافت نشد.' : 'Courses could not be loaded.')}</p>
              <button type="button" onClick={() => void courses.refetch()} className="mt-2 font-black underline">
                {fa ? 'تلاش دوباره' : 'Try again'}
              </button>
            </div>
          ) : filteredCourses.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="bg-[#f8f9fd] text-muted">
                  <tr>
                    <th className="p-4 text-start">{fa ? 'دوره' : 'Course'}</th>
                    <th className="p-4 text-start">{fa ? 'مدرس' : 'Instructor'}</th>
                    <th className="p-4 text-start">{fa ? 'ساختار' : 'Structure'}</th>
                    <th className="p-4 text-start">{fa ? 'وضعیت' : 'Status'}</th>
                    <th className="p-4 text-end">{fa ? 'عملیات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y hairline">
                  {filteredCourses.map((course) => (
                    <tr key={course.id} className="transition hover:bg-[#fafbff]">
                      <td className="p-4">
                        <div className="flex items-start gap-3">
                          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-lavender text-purple">
                            <BookOpen size={18} />
                          </span>
                          <div className="min-w-0">
                            <strong className="block truncate">{displayName(course, fa)}</strong>
                            <span className="latin mt-1 block truncate text-xs text-muted">/{course.slug}</span>
                            <span className="mt-2 inline-flex items-center gap-2 text-xs text-muted">
                              <span>{course.language}</span>
                              <span aria-hidden="true">·</span>
                              <span>{course.level}</span>
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="block">
                          {fa
                            ? (course.teacher?.nameFa ?? course.teacherName)
                            : (course.teacher?.nameEn ?? course.teacherName)}
                        </span>
                        <span className="mt-1 block text-xs text-muted">{formatMoney(course.price, locale)}</span>
                      </td>
                      <td className="p-4">
                        <span className="block">
                          {course.lessonsCount} {fa ? 'درس' : 'lessons'}
                        </span>
                        <span className="mt-1 flex items-center gap-1 text-xs text-muted">
                          <Users size={13} />
                          {course._count.enrollments.toLocaleString(fa ? 'fa-IR' : 'en-US')}{' '}
                          {fa ? 'ثبت‌نام' : 'enrolled'}
                        </span>
                      </td>
                      <td className="p-4">
                        <Status published={course.published} fa={fa} />
                      </td>
                      <td className="p-4">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={localePath(`/courses/${course.slug}`, locale)}
                            target="_blank"
                            className="grid size-9 place-items-center rounded-lg text-muted hover:bg-[#f1f3fb] hover:text-blue"
                            title={fa ? 'مشاهده دوره' : 'View course'}
                            aria-label={fa ? `مشاهده ${course.titleFa}` : `View ${course.titleEn}`}
                          >
                            <ExternalLink size={16} />
                          </Link>
                          <button
                            type="button"
                            onClick={() => startEdit(course)}
                            className="inline-flex items-center gap-1.5 rounded-lg border hairline px-3 py-2 font-bold text-blue"
                          >
                            <Pencil size={15} />
                            {fa ? 'ویرایش' : 'Edit'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid min-h-64 place-items-center p-8 text-center">
              <div>
                <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#f1f3fb] text-muted">
                  <BookOpen size={21} />
                </span>
                <strong className="mt-4 block">{fa ? 'دوره‌ای پیدا نشد' : 'No courses found'}</strong>
                <p className="mt-2 text-sm text-muted">
                  {search || status !== 'all'
                    ? fa
                      ? 'فیلترها را تغییر دهید یا یک دوره جدید بسازید.'
                      : 'Adjust the filters or create a new course.'
                    : fa
                      ? 'اولین دوره را از فرم کنار صفحه بسازید.'
                      : 'Create the first course with the form beside this list.'}
                </p>
              </div>
            </div>
          )}
          <div className="border-t hairline px-4 py-3 text-xs text-muted">
            {fa
              ? `${filteredCourses.length.toLocaleString('fa-IR')} دوره از ${courses.data?.length.toLocaleString('fa-IR') ?? '۰'} دوره`
              : `${filteredCourses.length.toLocaleString('en-US')} of ${courses.data?.length.toLocaleString('en-US') ?? 0} courses`}
          </div>
        </section>

        <section className="panel-card p-5 sm:p-6 xl:sticky xl:top-24 xl:self-start">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.12em] text-purple">
                {editing ? (fa ? 'ویرایش کاتالوگ' : 'Edit catalog') : fa ? 'ساخت کاتالوگ' : 'Create catalog'}
              </p>
              <h2 className="mt-2 text-2xl font-black">
                {editing ? (fa ? 'ویرایش دوره' : 'Edit course') : fa ? 'دوره جدید' : 'New course'}
              </h2>
            </div>
            {editing && (
              <button
                type="button"
                onClick={startNew}
                className="grid size-9 place-items-center rounded-lg text-muted hover:bg-[#f1f3fb]"
                title={fa ? 'ساخت دوره جدید' : 'Create a new course'}
                aria-label={fa ? 'ساخت دوره جدید' : 'Create a new course'}
              >
                <X size={18} />
              </button>
            )}
          </div>

          <form className="mt-5 grid gap-4" onSubmit={submit}>
            <Field label="Slug" hint={fa ? 'فقط حروف انگلیسی کوچک و خط تیره' : 'Lowercase letters and hyphens only'}>
              <input
                value={form.slug}
                onChange={(event) => update('slug', event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                className={`${inputClass} latin`}
                dir="ltr"
                aria-label="Slug"
                required
                maxLength={120}
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={fa ? 'عنوان فارسی' : 'Persian title'}>
                <input
                  value={form.titleFa}
                  onChange={(event) => update('titleFa', event.target.value)}
                  className={inputClass}
                  required
                  minLength={3}
                  maxLength={180}
                />
              </Field>
              <Field label={fa ? 'عنوان انگلیسی' : 'English title'}>
                <input
                  value={form.titleEn}
                  onChange={(event) => update('titleEn', event.target.value)}
                  className={`${inputClass} latin`}
                  dir="ltr"
                  required
                  minLength={3}
                  maxLength={180}
                />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={fa ? 'توضیح فارسی' : 'Persian description'}>
                <textarea
                  value={form.descriptionFa}
                  onChange={(event) => update('descriptionFa', event.target.value)}
                  className={`${inputClass} min-h-32 resize-y leading-7`}
                  required
                  minLength={20}
                  maxLength={10000}
                />
              </Field>
              <Field label={fa ? 'توضیح انگلیسی' : 'English description'}>
                <textarea
                  value={form.descriptionEn}
                  onChange={(event) => update('descriptionEn', event.target.value)}
                  className={`${inputClass} min-h-32 resize-y leading-7`}
                  dir="ltr"
                  required
                  minLength={20}
                  maxLength={10000}
                />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={fa ? 'زبان دوره' : 'Course language'}>
                <input
                  value={form.language}
                  onChange={(event) => update('language', event.target.value)}
                  className={inputClass}
                  required
                  minLength={2}
                  maxLength={80}
                />
              </Field>
              <Field
                label={fa ? 'سطح' : 'Level'}
                hint={fa ? 'مثل A1، A1–C1، IELTS یا All levels' : 'e.g. A1, A1–C1, IELTS or All levels'}
              >
                <input
                  value={form.level}
                  onChange={(event) => update('level', event.target.value)}
                  className={inputClass}
                  list="course-level-suggestions"
                  aria-label={fa ? 'سطح' : 'Level'}
                  required
                  minLength={2}
                  maxLength={40}
                />
                <datalist id="course-level-suggestions">
                  {levelSuggestions.map((level) => (
                    <option key={level} value={level} />
                  ))}
                </datalist>
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={fa ? 'نوع دوره' : 'Course format'}>
                <select
                  value={form.format}
                  onChange={(event) => update('format', event.target.value as CourseFormat)}
                  className={inputClass}
                >
                  <option value="SELF_PACED">{fa ? 'ویدیویی (خودخوان)' : 'Self-paced'}</option>
                  <option value="LIVE_ONLINE">{fa ? 'کلاس زنده' : 'Live class'}</option>
                </select>
              </Field>
              {form.format === 'LIVE_ONLINE' && (
                <Field
                  label={fa ? 'پکیج جلسات' : 'Session package'}
                  hint={fa ? 'تعداد جلسات دوره از این پکیج خوانده می‌شود.' : 'The course session count comes from this package.'}
                >
                  <select
                    value={form.packageId}
                    onChange={(event) => update('packageId', event.target.value)}
                    className={inputClass}
                    aria-label={fa ? 'پکیج جلسات' : 'Session package'}
                    disabled={!form.teacherId}
                    required
                  >
                    <option value="">{fa ? 'انتخاب کنید' : 'Select a package'}</option>
                    {teacherPackages.map((pkg) => (
                      <option key={pkg.id} value={pkg.id}>
                        {`${fa ? pkg.titleFa : pkg.titleEn} — ${pkg.credits} ${fa ? 'جلسه' : 'sessions'}`}
                      </option>
                    ))}
                  </select>
                  {form.teacherId && teacherPackages.length === 0 && (
                    <span className="mt-1 block text-xs text-red-600">
                      {fa ? 'این مدرس پکیج فعالی ندارد.' : 'This instructor has no available package.'}
                    </span>
                  )}
                </Field>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={fa ? 'مدرس' : 'Instructor'}>
                <select
                  value={form.teacherId}
                  onChange={(event) => update('teacherId', event.target.value)}
                  className={inputClass}
                  disabled={instructors.isLoading || instructors.isError}
                >
                  <option value="">{fa ? 'بدون مدرس' : 'No instructor'}</option>
                  {(instructors.data ?? []).map((instructor) => (
                    <option key={instructor.id} value={instructor.id}>
                      {instructorName(instructor, fa)}
                    </option>
                  ))}
                </select>
                {instructors.isError && (
                  <span className="mt-1 block text-xs text-red-600">
                    {fa ? 'فهرست مدرس‌ها دریافت نشد.' : 'Instructors could not be loaded.'}
                  </span>
                )}
              </Field>
              <Field label={fa ? 'قیمت (تومان)' : 'Price ( toman )'}>
                <input
                  type="number"
                  value={form.price}
                  onChange={(event) => update('price', Number(event.target.value))}
                  className={`${inputClass} latin`}
                  dir="ltr"
                  required
                  min={0}
                  max={2000000000}
                />
              </Field>
            </div>
            <Field
              label={fa ? 'تصویر دوره' : 'Course image'}
              hint={fa ? 'مسیر یا URL تصویر جلد' : 'Cover image path or URL'}
            >
              <input
                value={form.image}
                onChange={(event) => update('image', event.target.value)}
                className={`${inputClass} latin`}
                dir="ltr"
                maxLength={2000}
                placeholder="/images/courses/..."
              />
            </Field>
            <label className="flex items-start gap-3 rounded-xl border hairline bg-[#fafbfe] p-3 text-sm">
              <input
                type="checkbox"
                checked={form.published}
                onChange={(event) => update('published', event.target.checked)}
                className="mt-0.5 size-5 accent-purple"
              />
              <span>
                <strong className="block">{fa ? 'انتشار دوره' : 'Publish course'}</strong>
                <span className="mt-1 block text-xs leading-6 text-muted">
                  {fa
                    ? 'برای انتشار، مدرس لازم است؛ دوره ویدیویی حداقل یک درس منتشرشده و کلاس زنده یک پکیج جلسات می‌خواهد.'
                    : 'Publishing requires an instructor; a self-paced course also needs a published lesson and a live class needs a session package.'}
                </span>
              </span>
            </label>

            {save.isError && (
              <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                {apiMessage(save.error, fa ? 'ذخیره دوره انجام نشد.' : 'The course could not be saved.')}
              </p>
            )}
            {notice && (
              <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">
                {notice}
              </p>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={save.isPending}
                className="primary-button flex-1 justify-center disabled:opacity-60"
              >
                <Save size={17} />
                {save.isPending
                  ? fa
                    ? 'در حال ذخیره...'
                    : 'Saving...'
                  : editing
                    ? fa
                      ? 'ذخیره تغییرات'
                      : 'Save changes'
                    : fa
                      ? 'ساخت دوره'
                      : 'Create course'}
              </button>
              {editing && (
                <button
                  type="button"
                  onClick={() => startEdit(editing)}
                  className="secondary-button"
                  title={fa ? 'بازگردانی تغییرات' : 'Discard changes'}
                  aria-label={fa ? 'بازگردانی تغییرات' : 'Discard changes'}
                >
                  <RefreshCw size={16} />
                </button>
              )}
            </div>
          </form>
        </section>
      </div>
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-black">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs leading-5 text-muted">{hint}</span>}
    </label>
  );
}

function Status({ published, fa }: { published: boolean; fa: boolean }) {
  return (
    <span className={`status-pill ${published ? 'bg-emerald-50 text-emerald-700' : 'bg-orange-50 text-orange-700'}`}>
      <span className={`me-1.5 size-1.5 rounded-full ${published ? 'bg-emerald-500' : 'bg-orange-500'}`} />
      {published ? (fa ? 'منتشرشده' : 'Published') : fa ? 'پیش‌نویس' : 'Draft'}
    </span>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tone = 'text-purple',
  loading,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  tone?: string;
  loading: boolean;
}) {
  return (
    <article className="panel-card flex items-center gap-4 p-4">
      <span className={`grid size-10 shrink-0 place-items-center rounded-xl bg-[#f1f3fb] ${tone}`}>
        <Icon size={19} />
      </span>
      <div>
        <p className="text-xs text-muted">{label}</p>
        <strong className="mt-1 block text-xl font-black">{loading ? '—' : value.toLocaleString()}</strong>
      </div>
    </article>
  );
}
