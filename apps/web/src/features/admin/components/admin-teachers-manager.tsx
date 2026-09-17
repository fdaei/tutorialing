'use client';

import { Portal } from '@/shared/components/ui/portal';
import { localized, isDefaultLocale } from '@/lib/i18n';
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, ImagePlus, LoaderCircle, Pencil, Plus, Search, Upload, X } from 'lucide-react';
import { api, apiField, ApiError, Paginated } from '@/shared/services/api';
import { useTranslations } from '@/components/shared/locale-provider';
import { uploadPanelFile } from '@/features/panel/services/upload-panel-file';
import { uploadErrorMessage } from '@/shared/services/upload';

type Language = { id: string; nameFa: string; nameEn: string; flag?: string | null };
type TeacherRow = {
  id: string;
  slug: string;
  nameFa: string;
  nameEn: string;
  status: string;
  rating: number;
  reviewsCount: number;
  experienceYears: number;
  approvedTrialPrice: number | null;
  approvedRegularPrice: number | null;
  avatarUrl: string | null;
  user: { phone: string | null; email: string | null };
  languageLinks: { language: Language }[];
};
type TeacherDetail = {
  id: string;
  nameFa: string;
  nameEn: string;
  bioFa: string;
  bioEn: string;
  specialties: string[];
  experienceYears: number;
  gender: string | null;
  lessonDuration: number;
  trialDuration: number;
  breakMinutes: number;
  trialPrice: number;
  regularPrice: number;
  approvedTrialPrice: number | null;
  approvedRegularPrice: number | null;
  status: string;
  avatarUrl: string | null;
  user: { phone: string | null; email: string | null };
  languageLinks: { languageId?: string; levels: string[]; language: Language }[];
};

type Form = {
  phone: string;
  email: string;
  nameFa: string;
  nameEn: string;
  bioFa: string;
  bioEn: string;
  specialties: string;
  languageIds: string[];
  levels: string[];
  experienceYears: string;
  gender: string;
  lessonDuration: string;
  trialDuration: string;
  breakMinutes: string;
  trialPrice: string;
  regularPrice: string;
  approvedTrialPrice: string;
  approvedRegularPrice: string;
  status: string;
  avatarFileId?: string | null;
};

const STATUSES = ['DRAFT', 'SUBMITTED', 'DOCUMENT_REVIEW', 'INTERVIEW', 'DEMO_REVIEW', 'APPROVED', 'REJECTED'];
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const statusFa: Record<string, string> = {
  DRAFT: 'پیش‌نویس',
  SUBMITTED: 'ارسال‌شده',
  DOCUMENT_REVIEW: 'بررسی مدارک',
  INTERVIEW: 'مصاحبه',
  DEMO_REVIEW: 'بررسی جلسه نمونه',
  APPROVED: 'تأییدشده',
  REJECTED: 'ردشده',
};
const statusTone: Record<string, string> = {
  APPROVED: 'bg-emerald-50 text-emerald-700',
  REJECTED: 'bg-red-50 text-red-700',
  DRAFT: 'bg-slate-100 text-slate-600',
};

const emptyForm: Form = {
  phone: '',
  email: '',
  nameFa: '',
  nameEn: '',
  bioFa: '',
  bioEn: '',
  specialties: '',
  languageIds: [],
  levels: [],
  experienceYears: '0',
  gender: '',
  lessonDuration: '60',
  trialDuration: '30',
  breakMinutes: '0',
  trialPrice: '0',
  regularPrice: '0',
  approvedTrialPrice: '',
  approvedRegularPrice: '',
  status: 'DRAFT',
};

function toForm(t: TeacherDetail): Form {
  return {
    phone: t.user.phone ?? '',
    email: t.user.email ?? '',
    nameFa: t.nameFa,
    nameEn: t.nameEn,
    bioFa: t.bioFa,
    bioEn: t.bioEn,
    specialties: t.specialties.join('، '),
    languageIds: t.languageLinks.map((link) => link.languageId ?? link.language.id),
    levels: [...new Set(t.languageLinks.flatMap((link) => link.levels))],
    experienceYears: String(t.experienceYears),
    gender: t.gender ?? '',
    lessonDuration: String(t.lessonDuration),
    trialDuration: String(t.trialDuration),
    breakMinutes: String(t.breakMinutes),
    trialPrice: String(t.trialPrice),
    regularPrice: String(t.regularPrice),
    approvedTrialPrice: t.approvedTrialPrice == null ? '' : String(t.approvedTrialPrice),
    approvedRegularPrice: t.approvedRegularPrice == null ? '' : String(t.approvedRegularPrice),
    status: t.status,
  };
}

function toPayload(form: Form, editing: boolean) {
  const int = (value: string) => Math.trunc(Number(value) || 0);
  const nullableInt = (value: string) => (value.trim() === '' ? null : int(value));
  return {
    phone: form.phone.trim(),
    // null clears the email on edit; on create it is simply omitted.
    ...(form.email.trim() ? { email: form.email.trim() } : editing ? { email: null } : {}),
    nameFa: form.nameFa.trim(),
    nameEn: form.nameEn.trim(),
    bioFa: form.bioFa.trim(),
    bioEn: form.bioEn.trim(),
    specialties: form.specialties
      .split(/[,،\n]/)
      .map((item) => item.trim())
      .filter(Boolean),
    languageIds: form.languageIds,
    levels: form.levels,
    experienceYears: int(form.experienceYears),
    ...(form.gender.trim() && { gender: form.gender.trim() }),
    lessonDuration: int(form.lessonDuration),
    trialDuration: int(form.trialDuration),
    breakMinutes: int(form.breakMinutes),
    trialPrice: int(form.trialPrice),
    regularPrice: int(form.regularPrice),
    approvedTrialPrice: nullableInt(form.approvedTrialPrice),
    approvedRegularPrice: nullableInt(form.approvedRegularPrice),
    status: form.status,
    ...(form.avatarFileId !== undefined && { avatarFileId: form.avatarFileId }),
  };
}

export function AdminTeachersManager() {
  const { locale } = useTranslations(),
    fa = isDefaultLocale(locale),
    [page, setPage] = useState(1),
    [search, setSearch] = useState(''),
    [draft, setDraft] = useState(''),
    [status, setStatus] = useState(''),
    [editing, setEditing] = useState<string | 'new'>();
  const query = useQuery({
    queryKey: ['admin-teachers', page, search, status],
    queryFn: () =>
      api<Paginated<TeacherRow>>(
        `/admin/teachers?page=${page}&search=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}`,
      ),
  });
  const data = query.data;
  const t = (faText: string, enText: string) => localized({ fa: faText, en: enText }, locale);

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-purple">{t('مدیریت مدرس‌ها', 'Teacher management')}</p>
          <h1 className="mt-2 text-3xl font-black">{t('مدرس‌ها', 'Teachers')}</h1>
          <p className="mt-2 text-sm text-muted">
            {t(
              'مشاهده، جستجو، ویرایش اطلاعات، عکس، قیمت و وضعیت مدرس‌ها',
              'Browse, search and edit teacher details, photo, pricing and status',
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="brand-gradient inline-flex items-center gap-2 rounded-xl px-5 py-3 font-black text-white"
        >
          <Plus size={18} />
          {t('افزودن مدرس', 'Add teacher')}
        </button>
      </div>
      <div className="panel-card overflow-hidden">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setSearch(draft.trim());
          }}
          className="flex flex-col gap-3 border-b hairline p-4 md:flex-row"
        >
          <label className="flex flex-1 items-center gap-2 rounded-xl border hairline bg-[#fafbfe] px-4">
            <Search size={18} className="text-muted" />
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              aria-label={t('جستجو با نام، موبایل یا ایمیل', 'Search by name, phone or email')}
              placeholder={t('جستجو با نام، موبایل یا ایمیل', 'Search by name, phone or email')}
              className="w-full bg-transparent py-3 outline-none"
            />
          </label>
          <select
            aria-label={t('وضعیت', 'Status')}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border hairline bg-white px-4 py-3"
          >
            <option value="">{t('همه وضعیت‌ها', 'All statuses')}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s, fa)}
              </option>
            ))}
          </select>
          <button className="rounded-xl bg-navy px-6 py-3 font-black text-white">{t('جستجو', 'Search')}</button>
        </form>
        {query.isLoading ? (
          <div className="grid gap-3 p-5">
            <div className="skeleton h-20 rounded-2xl" />
            <div className="skeleton h-20 rounded-2xl" />
          </div>
        ) : query.isError ? (
          <div role="alert" className="m-5 rounded-2xl bg-red-50 p-4 text-red-700">
            {errorMessage(query.error, fa)}{' '}
            <button type="button" onClick={() => query.refetch()} className="font-black underline">
              {t('تلاش دوباره', 'Try again')}
            </button>
          </div>
        ) : data?.data.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-[#f8f9fd] text-muted">
                  <tr>
                    <th className="p-4 text-start">{t('مدرس', 'Teacher')}</th>
                    <th className="p-4 text-start">{t('تماس', 'Contact')}</th>
                    <th className="p-4 text-start">{t('زبان‌ها', 'Languages')}</th>
                    <th className="p-4 text-start">{t('امتیاز', 'Rating')}</th>
                    <th className="p-4 text-start">{t('وضعیت', 'Status')}</th>
                    <th className="p-4 text-start">{t('عملیات', 'Actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y hairline">
                  {data.data.map((row) => (
                    <tr key={row.id} className="hover:bg-[#fafbff]">
                      <td className="p-4">
                        <span className="flex items-center gap-3">
                          <Avatar
                            url={row.avatarUrl}
                            name={localized({ fa: row.nameFa, en: row.nameEn }, locale)}
                            size="size-11"
                          />
                          <span>
                            <strong className="block">{localized({ fa: row.nameFa, en: row.nameEn }, locale)}</strong>
                            <small className="text-muted">
                              {t(`${row.experienceYears} سال سابقه`, `${row.experienceYears} yrs experience`)}
                            </small>
                          </span>
                        </span>
                      </td>
                      <td className="p-4">
                        <span dir="ltr" className="block">
                          {row.user.phone ?? '—'}
                        </span>
                        {row.user.email && <small className="text-muted">{row.user.email}</small>}
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1.5">
                          {row.languageLinks.map(({ language }) => (
                            <span
                              key={language.id}
                              className="rounded-full bg-lavender px-2.5 py-1 text-xs font-bold text-purple"
                            >
                              {language.flag ? `${language.flag} ` : ''}
                              {localized({ fa: language.nameFa, en: language.nameEn }, locale)}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-4 text-muted">
                        {row.rating.toFixed(1)} ({row.reviewsCount})
                      </td>
                      <td className="p-4">
                        <StatusBadge value={row.status} fa={fa} />
                      </td>
                      <td className="p-4">
                        <button
                          type="button"
                          onClick={() => setEditing(row.id)}
                          className="inline-flex items-center gap-2 rounded-xl border hairline px-3 py-2 font-bold text-blue"
                        >
                          <Pencil size={15} />
                          {t('ویرایش', 'Edit')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={data.page} pages={data.totalPages} total={data.total} setPage={setPage} fa={fa} />
          </>
        ) : (
          <div className="p-12 text-center text-muted">{t('مدرسی پیدا نشد.', 'No teachers found.')}</div>
        )}
      </div>
      {editing && (
        <TeacherEditor id={editing === 'new' ? undefined : editing} close={() => setEditing(undefined)} fa={fa} />
      )}
    </section>
  );
}

function TeacherEditor({ id, close, fa }: { id?: string; close: () => void; fa: boolean }) {
  const qc = useQueryClient();
  const dialogRef = useRef<HTMLElement>(null);
  const t = (faText: string, enText: string) => localized({ fa: faText, en: enText }, fa);
  const detail = useQuery({
    queryKey: ['admin-teacher-detail', id],
    queryFn: () => api<TeacherDetail>(`/admin/teachers/${id}`),
    enabled: Boolean(id),
  });
  const languages = useQuery({ queryKey: ['languages'], queryFn: () => api<Language[]>('/languages') });
  const [form, setForm] = useState<Form>(emptyForm);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    dialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [close]);
  useEffect(() => {
    if (detail.data) {
      setForm(toForm(detail.data));
      setPreview(detail.data.avatarUrl);
    }
  }, [detail.data]);
  useEffect(
    () => () => {
      if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const save = useMutation({
    mutationFn: () =>
      api<TeacherDetail>(id ? `/admin/teachers/${id}` : '/admin/teachers', {
        method: id ? 'PATCH' : 'POST',
        body: JSON.stringify(toPayload(form, Boolean(id))),
      }),
    onSuccess: async (teacher) => {
      await qc.invalidateQueries({ queryKey: ['admin-teachers'] });
      if (!id) return close();
      qc.setQueryData(['admin-teacher-detail', id], teacher);
      setSaved(true);
    },
  });

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setSaved(false);
    setForm((current) => ({ ...current, [key]: value }));
  };
  const toggle = (key: 'languageIds' | 'levels', value: string) =>
    set(key, form[key].includes(value) ? form[key].filter((v) => v !== value) : [...form[key], value]);

  async function onAvatar(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;
    setUploadError('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setUploadError(t('فقط تصویر JPG، PNG یا WEBP مجاز است.', 'Only JPG, PNG or WEBP images are allowed.'));
      input.value = '';
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setUploadError(t('حجم تصویر نباید بیشتر از ۵ مگابایت باشد.', 'The image must be 5 MB or smaller.'));
      input.value = '';
      return;
    }
    setUploading(true);
    try {
      const fileId = await uploadPanelFile(file, 'teacher-avatar', fa);
      set('avatarFileId', fileId);
      setPreview(URL.createObjectURL(file));
    } catch (error) {
      setUploadError(uploadErrorMessage(error, t('آپلود تصویر انجام نشد.', 'The image upload failed.')));
    } finally {
      setUploading(false);
      input.value = '';
    }
  }

  const title = id ? t('ویرایش مدرس', 'Edit teacher') : t('افزودن مدرس', 'Add teacher');
  const busy = save.isPending || uploading;

  return (
    <Portal>
      <div className="fixed inset-0 z-[80] bg-navy/35 p-3 backdrop-blur-sm" onClick={close}>
        <aside
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-teacher-editor-title"
          tabIndex={-1}
          className={`h-full w-full max-w-3xl overflow-y-auto bg-[#f8f9fd] p-5 shadow-2xl md:p-7 ${fa ? 'mr-auto rounded-l-[28px]' : 'ml-auto rounded-r-[28px]'}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-3">
            <h2 id="admin-teacher-editor-title" className="text-2xl font-black">
              {title}
            </h2>
            <button
              type="button"
              onClick={close}
              className="grid size-10 place-items-center rounded-full border hairline bg-white"
              aria-label={t('بستن', 'Close')}
            >
              <X />
            </button>
          </div>
          {id && detail.isLoading ? (
            <div className="skeleton mt-6 h-64 rounded-3xl" />
          ) : id && detail.isError ? (
            <div role="alert" className="mt-6 rounded-2xl bg-red-50 p-4 text-red-700">
              {errorMessage(detail.error, fa)}
            </div>
          ) : (
            <form
              className="mt-6 grid gap-5"
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate();
              }}
            >
              <section className="panel-card flex flex-wrap items-center gap-5 p-5">
                <Avatar url={preview} name={form.nameFa || form.nameEn} size="size-24" />
                <div className="grid gap-2">
                  <div className="flex flex-wrap gap-2">
                    <label className="secondary-button cursor-pointer">
                      {uploading ? <LoaderCircle size={16} className="animate-spin" /> : <Upload size={16} />}
                      {uploading ? t('در حال آپلود...', 'Uploading...') : t('انتخاب عکس', 'Choose photo')}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        aria-label={t('انتخاب عکس مدرس', 'Choose teacher photo')}
                        className="hidden"
                        disabled={uploading}
                        onChange={onAvatar}
                      />
                    </label>
                    {preview && (
                      <button
                        type="button"
                        onClick={() => {
                          set('avatarFileId', null);
                          setPreview(null);
                        }}
                        className="rounded-xl border hairline bg-white px-4 py-2 text-sm font-bold text-red-600"
                      >
                        {t('حذف عکس', 'Remove photo')}
                      </button>
                    )}
                  </div>
                  <small className="text-muted">
                    {t('JPG، PNG یا WEBP تا ۵ مگابایت', 'JPG, PNG or WEBP up to 5 MB')}
                  </small>
                  {uploadError && (
                    <p role="alert" className="text-sm text-red-700">
                      {uploadError}
                    </p>
                  )}
                </div>
              </section>

              <section className="panel-card grid gap-4 p-5 md:grid-cols-2">
                <h3 className="font-black md:col-span-2">{t('اطلاعات اصلی', 'Basic information')}</h3>
                <Input
                  label={t('نام (فارسی)', 'Name (Persian)')}
                  value={form.nameFa}
                  onChange={(v) => set('nameFa', v)}
                  required
                  minLength={2}
                  maxLength={80}
                  error={apiField(save.error, 'nameFa')}
                />
                <Input
                  label={t('نام (انگلیسی)', 'Name (English)')}
                  value={form.nameEn}
                  onChange={(v) => set('nameEn', v)}
                  required
                  minLength={2}
                  maxLength={80}
                  dir="ltr"
                  error={apiField(save.error, 'nameEn')}
                />
                <Input
                  label={t('موبایل', 'Phone')}
                  value={form.phone}
                  onChange={(v) => set('phone', v)}
                  required
                  dir="ltr"
                  placeholder="09xxxxxxxxx"
                  error={apiField(save.error, 'phone')}
                />
                <Input
                  label={t('ایمیل', 'Email')}
                  value={form.email}
                  onChange={(v) => set('email', v)}
                  type="email"
                  dir="ltr"
                  error={apiField(save.error, 'email')}
                />
                <Input
                  label={t('سال‌های سابقه', 'Years of experience')}
                  value={form.experienceYears}
                  onChange={(v) => set('experienceYears', v)}
                  type="number"
                  min={0}
                  max={60}
                />
                <Input
                  label={t('جنسیت', 'Gender')}
                  value={form.gender}
                  onChange={(v) => set('gender', v)}
                  maxLength={40}
                />
                <label className="grid gap-1.5 text-sm font-bold md:col-span-2">
                  {t('وضعیت', 'Status')}
                  <select value={form.status} onChange={(e) => set('status', e.target.value)} className="input">
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {statusLabel(s, fa)}
                      </option>
                    ))}
                  </select>
                </label>
              </section>

              <section className="panel-card grid gap-4 p-5">
                <h3 className="font-black">{t('بیوگرافی و تخصص', 'Bio and specialties')}</h3>
                <TextArea
                  label={t('بیوگرافی (فارسی)', 'Bio (Persian)')}
                  value={form.bioFa}
                  onChange={(v) => set('bioFa', v)}
                />
                <TextArea
                  label={t('بیوگرافی (انگلیسی)', 'Bio (English)')}
                  value={form.bioEn}
                  onChange={(v) => set('bioEn', v)}
                  dir="ltr"
                />
                <Input
                  label={t('تخصص‌ها (با کاما جدا کنید)', 'Specialties (comma separated)')}
                  value={form.specialties}
                  onChange={(v) => set('specialties', v)}
                />
                <fieldset>
                  <legend className="text-sm font-bold">{t('زبان‌های تدریس', 'Teaching languages')}</legend>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {languages.isLoading && (
                      <span className="text-sm text-muted">{t('در حال بارگذاری...', 'Loading...')}</span>
                    )}
                    {languages.data?.map((language) => (
                      <Chip
                        key={language.id}
                        checked={form.languageIds.includes(language.id)}
                        onChange={() => toggle('languageIds', language.id)}
                      >
                        {language.flag ? `${language.flag} ` : ''}
                        {localized({ fa: language.nameFa, en: language.nameEn }, fa)}
                      </Chip>
                    ))}
                  </div>
                </fieldset>
                <fieldset>
                  <legend className="text-sm font-bold">{t('سطوح تدریس', 'Teaching levels')}</legend>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {LEVELS.map((level) => (
                      <Chip key={level} checked={form.levels.includes(level)} onChange={() => toggle('levels', level)}>
                        {level}
                      </Chip>
                    ))}
                  </div>
                </fieldset>
              </section>

              <section className="panel-card grid gap-4 p-5 md:grid-cols-2">
                <h3 className="font-black md:col-span-2">{t('زمان‌بندی و قیمت', 'Schedule and pricing')}</h3>
                <Input
                  label={t('مدت جلسه (دقیقه)', 'Lesson length (min)')}
                  value={form.lessonDuration}
                  onChange={(v) => set('lessonDuration', v)}
                  type="number"
                  min={20}
                  max={180}
                />
                <Input
                  label={t('مدت جلسه آزمایشی (دقیقه)', 'Trial length (min)')}
                  value={form.trialDuration}
                  onChange={(v) => set('trialDuration', v)}
                  type="number"
                  min={15}
                  max={90}
                />
                <Input
                  label={t('استراحت بین جلسات (دقیقه)', 'Break between lessons (min)')}
                  value={form.breakMinutes}
                  onChange={(v) => set('breakMinutes', v)}
                  type="number"
                  min={0}
                  max={120}
                />
                <span className="hidden md:block" />
                <Input
                  label={t('قیمت پیشنهادی جلسه آزمایشی', 'Proposed trial price')}
                  value={form.trialPrice}
                  onChange={(v) => set('trialPrice', v)}
                  type="number"
                  min={0}
                />
                <Input
                  label={t('قیمت پیشنهادی جلسه عادی', 'Proposed regular price')}
                  value={form.regularPrice}
                  onChange={(v) => set('regularPrice', v)}
                  type="number"
                  min={0}
                />
                <Input
                  label={t('قیمت تأییدشده جلسه آزمایشی', 'Approved trial price')}
                  value={form.approvedTrialPrice}
                  onChange={(v) => set('approvedTrialPrice', v)}
                  type="number"
                  min={0}
                />
                <Input
                  label={t('قیمت تأییدشده جلسه عادی', 'Approved regular price')}
                  value={form.approvedRegularPrice}
                  onChange={(v) => set('approvedRegularPrice', v)}
                  type="number"
                  min={0}
                />
              </section>

              {save.error && (
                <p role="alert" className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">
                  {errorMessage(save.error, fa)}
                </p>
              )}
              {saved && (
                <p role="status" className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-700">
                  {t('تغییرات ذخیره شد.', 'Changes saved.')}
                </p>
              )}
              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={busy || !form.languageIds.length}
                  className="brand-gradient inline-flex items-center gap-2 rounded-xl px-6 py-3 font-black text-white disabled:opacity-40"
                >
                  {save.isPending && <LoaderCircle size={16} className="animate-spin" />}
                  {id ? t('ذخیره تغییرات', 'Save changes') : t('ایجاد مدرس', 'Create teacher')}
                </button>
                <button
                  type="button"
                  onClick={close}
                  className="rounded-xl border hairline bg-white px-6 py-3 font-black"
                >
                  {t('انصراف', 'Cancel')}
                </button>
              </div>
            </form>
          )}
        </aside>
      </div>
    </Portal>
  );
}

function Input({
  label,
  onChange,
  error,
  ...props
}: { label: string; onChange: (value: string) => void; error?: string } & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'onChange'
>) {
  return (
    <label className="grid gap-1.5 text-sm font-bold">
      {label}
      <input {...props} onChange={(e) => onChange(e.target.value)} className="input font-normal" />
      {error && (
        <span role="alert" className="text-xs font-normal text-red-700">
          {error}
        </span>
      )}
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  dir,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  dir?: string;
}) {
  const { locale } = useTranslations();
  return (
    <label className="grid gap-1.5 text-sm font-bold">
      <span className="flex justify-between gap-2">
        {label}
        <small className={`font-normal ${value.trim().length < 40 ? 'text-red-600' : 'text-muted'}`}>
          {localized(
            { fa: `${value.trim().length} از ۴۰ تا ۳۰۰۰ نویسه`, en: `${value.trim().length} / 40–3000 chars` },
            locale,
          )}
        </small>
      </span>
      <textarea
        value={value}
        dir={dir}
        required
        minLength={40}
        maxLength={3000}
        rows={4}
        onChange={(e) => onChange(e.target.value)}
        className="input font-normal"
      />
    </label>
  );
}

function Chip({ checked, onChange, children }: { checked: boolean; onChange: () => void; children: React.ReactNode }) {
  return (
    <label
      className={`cursor-pointer rounded-full border px-3 py-2 text-sm font-bold ${checked ? 'border-purple bg-lavender text-purple' : 'hairline bg-white text-muted'}`}
    >
      <input className="sr-only" type="checkbox" checked={checked} onChange={onChange} />
      {children}
    </label>
  );
}

function Avatar({ url, name, size }: { url: string | null; name: string; size: string }) {
  return url ? (
    <img src={url} alt="" className={`${size} flex-none rounded-full object-cover`} />
  ) : (
    <span className={`brand-gradient grid ${size} flex-none place-items-center rounded-full font-black text-white`}>
      {name ? name.slice(0, 1) : <ImagePlus size={18} />}
    </span>
  );
}

function StatusBadge({ value, fa }: { value: string; fa: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusTone[value] ?? 'bg-amber-50 text-amber-700'}`}
    >
      {statusLabel(value, fa)}
    </span>
  );
}

function Pagination({
  page,
  pages,
  total,
  setPage,
  fa,
}: {
  page: number;
  pages: number;
  total: number;
  setPage: (n: number) => void;
  fa: boolean;
}) {
  const nf = new Intl.NumberFormat(fa ? 'fa-IR' : 'en-US');
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t hairline p-4">
      <p className="text-sm text-muted">{localized({ fa: `${nf.format(total)} مدرس`, en: `${total} teachers` }, fa)}</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={localized({ fa: 'صفحه قبل', en: 'Previous page' }, fa)}
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
          className="grid size-9 place-items-center rounded-lg border hairline disabled:opacity-30"
        >
          {fa ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
        </button>
        <span className="text-sm">
          {nf.format(page)} / {nf.format(Math.max(1, pages))}
        </span>
        <button
          type="button"
          aria-label={localized({ fa: 'صفحه بعد', en: 'Next page' }, fa)}
          disabled={page >= pages}
          onClick={() => setPage(page + 1)}
          className="grid size-9 place-items-center rounded-lg border hairline disabled:opacity-30"
        >
          {fa ? <ChevronLeft size={17} /> : <ChevronRight size={17} />}
        </button>
      </div>
    </div>
  );
}

function statusLabel(value: string, fa: boolean) {
  return fa ? (statusFa[value] ?? value) : value.replaceAll('_', ' ').toLowerCase();
}

function errorMessage(error: unknown, fa: boolean) {
  return error instanceof ApiError
    ? error.message
    : localized({ fa: 'بارگذاری یا ذخیره اطلاعات انجام نشد.', en: 'Could not load or save data.' }, fa);
}
