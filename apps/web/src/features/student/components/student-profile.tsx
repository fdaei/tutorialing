'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  Camera,
  Check,
  ChevronDown,
  Globe2,
  LoaderCircle,
  LockKeyhole,
  Mail,
  Smartphone,
  Trash2,
  UserRound,
} from 'lucide-react';
import { api, apiField, apiMessage } from '@/lib/api';
import { uploadFile } from '@/lib/file-upload';
import { PageHeading } from '@/components/shared/page-heading';

type Profile = {
  id: string;
  name: string | null;
  phone: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  locale: 'fa' | 'en' | null;
  timezone: string | null;
};
type Form = { name: string; email: string; locale: 'fa' | 'en'; timezone: string };
type Notice = { kind: 'success' | 'error'; message: string } | null;
const imageTypes = ['image/jpeg', 'image/png', 'image/webp'];

export function StudentProfile() {
  const qc = useQueryClient(),
    input = useRef<HTMLInputElement>(null),
    [preview, setPreview] = useState<string | null>(null),
    [notice, setNotice] = useState<Notice>(null);
  const q = useQuery({ queryKey: ['profile'], queryFn: () => api<Profile>('/users/me') });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<Form>();
  const refresh = () =>
    Promise.all([qc.invalidateQueries({ queryKey: ['profile'] }), qc.invalidateQueries({ queryKey: ['panel-me'] })]);
  const save = useMutation({
    mutationFn: (d: Form) => api('/users/me', { method: 'PUT', body: JSON.stringify(d) }),
    onSuccess: async (_, d) => {
      reset(d);
      await refresh();
      setNotice({ kind: 'success', message: 'تغییرات با موفقیت ذخیره شد.' });
    },
    onError: (e) => setNotice({ kind: 'error', message: apiMessage(e, 'ذخیره تغییرات انجام نشد. دوباره تلاش کنید.') }),
  });
  const avatar = useMutation({
    mutationFn: async (file: File) => {
      const fileId = await uploadFile(file, 'avatar');
      return api('/users/me/avatar', { method: 'PUT', body: JSON.stringify({ fileId }) });
    },
    onSuccess: async () => {
      setPreview(null);
      await refresh();
      setNotice({ kind: 'success', message: 'تصویر پروفایل با موفقیت بروزرسانی شد.' });
    },
    onError: () => {
      setPreview(null);
      setNotice({ kind: 'error', message: 'آپلود تصویر پروفایل انجام نشد. دوباره تلاش کنید.' });
    },
  });
  const remove = useMutation({
    mutationFn: () => api('/users/me/avatar', { method: 'DELETE' }),
    onSuccess: async () => {
      setPreview(null);
      await refresh();
      setNotice({ kind: 'success', message: 'تصویر پروفایل حذف شد.' });
    },
    onError: () => setNotice({ kind: 'error', message: 'حذف تصویر انجام نشد. دوباره تلاش کنید.' }),
  });
  useEffect(() => {
    if (q.data)
      reset({
        name: q.data.name ?? '',
        email: q.data.email ?? '',
        locale: q.data.locale ?? 'fa',
        timezone: q.data.timezone ?? 'Asia/Tehran',
      });
  }, [q.data, reset]);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  const completion = useMemo(
    () =>
      q.data
        ? [q.data.name, q.data.phone, q.data.email, q.data.locale, q.data.timezone].filter(Boolean).length * 20
        : 0,
    [q.data],
  );
  const name = q.data?.name?.trim() || 'زبان‌آموز',
    busy = avatar.isPending || remove.isPending;
  function choose(file?: File) {
    if (!file) return;
    if (!imageTypes.includes(file.type)) {
      setNotice({ kind: 'error', message: 'فرمت تصویر پشتیبانی نمی‌شود.' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setNotice({ kind: 'error', message: 'حجم تصویر نباید بیشتر از ۵ مگابایت باشد.' });
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return url;
    });
    setNotice(null);
    avatar.mutate(file);
  }
  return (
    <div className="profile-workspace">
      <PageHeading
        title="پروفایل و تنظیمات"
        description="اطلاعات حساب، زبان رابط و ترجیحات اعلان‌های خود را مدیریت کنید."
      />
      {notice && <Toast notice={notice} close={() => setNotice(null)} />}{' '}
      {q.isLoading && <div className="skeleton h-[520px] rounded-[20px]" />}
      {q.isError && (
        <div role="alert" className="rounded-2xl border border-red-100 bg-red-50 p-5 text-red-700">
          {apiMessage(q.error, 'اطلاعات پروفایل دریافت نشد.')}
        </div>
      )}
      {q.data && (
        <form
          onSubmit={handleSubmit((d) => save.mutate(d))}
          className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_284px]"
        >
          <div className="order-2 grid min-w-0 gap-5 lg:order-1">
            <Section icon={<UserRound />} title="اطلاعات شخصی" description="اطلاعات اصلی حساب کاربری شما">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="نام و نام خانوادگی" error={errors.name?.message || apiField(save.error, 'name')}>
                  <input
                    autoComplete="name"
                    className="profile-input"
                    {...register('name', {
                      required: 'نام و نام خانوادگی الزامی است.',
                      minLength: { value: 2, message: 'حداقل ۲ نویسه وارد کنید.' },
                    })}
                  />
                </Field>
                <Field label="شماره موبایل" helper="برای تغییر شماره با پشتیبانی تماس بگیرید.">
                  <div className="relative">
                    <Smartphone className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      dir="ltr"
                      className="profile-input cursor-not-allowed bg-slate-50 pl-4 pr-11 text-left text-slate-500"
                      value={q.data.phone ?? ''}
                      readOnly
                      aria-readonly="true"
                    />
                  </div>
                </Field>
                <Field
                  label="ایمیل"
                  error={errors.email?.message || apiField(save.error, 'email')}
                  className="md:col-span-2"
                >
                  <div className="relative">
                    <Mail className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      dir="ltr"
                      type="email"
                      autoComplete="email"
                      className="profile-input pl-4 pr-11 text-left"
                      {...register('email', {
                        pattern: { value: /^[^@]+@[^@]+\.[^@]+$/, message: 'ایمیل معتبر وارد کنید.' },
                      })}
                    />
                  </div>
                </Field>
              </div>
            </Section>
            <Section icon={<Globe2 />} title="زبان و منطقه زمانی" description="نمایش تاریخ‌ها و زبان رابط کاربری">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="زبان رابط">
                  <Select>
                    <select className="profile-input appearance-none" {...register('locale')}>
                      <option value="fa">فارسی</option>
                      <option value="en">English</option>
                    </select>
                  </Select>
                </Field>
                <Field label="منطقه زمانی">
                  <Select>
                    <select className="profile-input appearance-none" {...register('timezone')}>
                      <option value="Asia/Tehran">تهران (UTC+3:30)</option>
                      <option value="Europe/London">لندن</option>
                      <option value="America/Toronto">تورنتو</option>
                    </select>
                  </Select>
                </Field>
              </div>
            </Section>
            <Section icon={<Bell />} title="اعلان‌ها" description="نحوه دریافت یادآوری‌های آموزشی">
              <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 sm:p-5">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">یادآوری کلاس‌ها و آزمون‌ها</h3>
                  <p className="mt-1 text-xs leading-6 text-muted">اعلان‌های ضروری حساب همیشه فعال می‌مانند.</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked="true"
                  aria-label="یادآوری کلاس‌ها و آزمون‌ها"
                  className="relative h-7 w-12 shrink-0 rounded-full bg-indigo-600"
                >
                  <span className="absolute left-1 top-1 size-5 rounded-full bg-white shadow-sm" />
                </button>
              </div>
            </Section>
            <Section icon={<LockKeyhole />} title="امنیت" description="روش ورود و امنیت حساب">
              <div className="flex gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 text-sm leading-7 text-slate-700">
                <LockKeyhole className="mt-1 shrink-0 text-indigo-600" size={18} />
                <p>
                  ورود این حساب با کد یک‌بارمصرف انجام می‌شود؛ بنابراین رمز عبوری برای تغییر وجود ندارد. مدیریت
                  دستگاه‌ها پس از پشتیبانی سرویس نشست‌ها در دسترس قرار می‌گیرد.
                </p>
              </div>
            </Section>
            <div className="sticky bottom-4 z-10 flex items-center gap-4 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-[0_12px_35px_rgba(15,23,42,.1)] backdrop-blur sm:px-4">
              <p className="hidden text-xs text-muted sm:block">
                {isDirty ? 'تغییرات ذخیره‌نشده دارید.' : 'همه تغییرات ذخیره شده‌اند.'}
              </p>
              <button
                disabled={!isDirty || save.isPending}
                className="primary-button mr-auto min-w-36 justify-center px-6 py-3 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
              >
                {save.isPending ? (
                  <>
                    <LoaderCircle className="animate-spin" size={17} />
                    در حال ذخیره…
                  </>
                ) : (
                  <>
                    <Check size={17} />
                    ذخیره تغییرات
                  </>
                )}
              </button>
            </div>
          </div>
          <aside className="panel-card order-1 overflow-hidden lg:order-2 lg:sticky lg:top-24">
            <div className="h-20 bg-[linear-gradient(125deg,#315efb,#7654f6_72%,#9a77ff)]" />
            <div className="px-5 pb-5 text-center">
              <div className="relative mx-auto -mt-12 w-fit">
                <span className="grid size-24 overflow-hidden place-items-center rounded-full border-4 border-white bg-indigo-100 text-3xl font-black text-indigo-700 shadow-md">
                  {preview || q.data.avatarUrl ? (
                    <img
                      src={preview || q.data.avatarUrl || ''}
                      alt={`تصویر پروفایل ${name}`}
                      className="size-full object-cover"
                    />
                  ) : (
                    name.slice(0, 1) || 'ز'
                  )}
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => input.current?.click()}
                  aria-label="تغییر تصویر پروفایل"
                  className="absolute bottom-0 left-0 grid size-9 place-items-center rounded-full border-2 border-white bg-indigo-600 text-white shadow-md disabled:cursor-wait disabled:bg-indigo-400"
                >
                  {avatar.isPending ? <LoaderCircle className="animate-spin" size={16} /> : <Camera size={16} />}
                </button>
                <input
                  ref={input}
                  type="file"
                  className="sr-only"
                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    choose(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </div>
              <h2 className="mt-4 truncate text-lg font-black text-slate-900">{name}</h2>
              <span className="mt-1 inline-flex rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
                زبان‌آموز
              </span>
              <p dir="ltr" className="mt-3 truncate text-sm text-muted">
                {q.data.email || q.data.phone || 'اطلاعات تماس ثبت نشده'}
              </p>
              <div className="mt-5 border-t border-slate-100 pt-5 text-right">
                <div className="flex justify-between text-xs">
                  <span className="font-bold text-slate-700">تکمیل پروفایل</span>
                  <b className="text-indigo-700">{completion.toLocaleString('fa-IR')}٪</b>
                </div>
                <div
                  className="mt-2.5 h-2 overflow-hidden rounded-full bg-slate-100"
                  role="progressbar"
                  aria-valuenow={completion}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="درصد تکمیل پروفایل"
                >
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,#315efb,#7654f6)] transition-[width]"
                    style={{ width: `${completion}%` }}
                  />
                </div>
                <p className="mt-3 text-xs leading-6 text-muted">
                  با کامل‌کردن اطلاعات، تجربه آموزشی دقیق‌تری خواهید داشت.
                </p>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => input.current?.click()}
                  className="secondary-button justify-center px-2 text-xs"
                >
                  <Camera size={15} />
                  {q.data.avatarUrl ? 'تغییر تصویر' : 'افزودن تصویر'}
                </button>
                <button
                  type="button"
                  disabled={!q.data.avatarUrl || busy}
                  onClick={() => {
                    if (window.confirm('تصویر پروفایل حذف شود؟')) remove.mutate();
                  }}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-100 px-2 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Trash2 size={15} />
                  حذف تصویر
                </button>
              </div>
              <p className="mt-3 text-[11px] text-muted">JPG، PNG یا WebP تا ۵ مگابایت</p>
            </div>
          </aside>
        </form>
      )}
    </div>
  );
}
function Section({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel-card p-5 sm:p-6">
      <header className="mb-5 flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600 [&>svg]:size-5">
          {icon}
        </span>
        <div>
          <h2 className="font-black text-slate-900">{title}</h2>
          <p className="mt-1 text-xs leading-5 text-muted">{description}</p>
        </div>
      </header>
      {children}
    </section>
  );
}
function Field({
  label,
  helper,
  error,
  className = '',
  children,
}: {
  label: string;
  helper?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="mb-2 block text-sm font-bold text-slate-700">{label}</span>
      {children}
      {helper && <small className="mt-2 block text-xs leading-5 text-muted">{helper}</small>}
      {error && (
        <small role="alert" className="mt-2 block text-xs font-medium text-red-600">
          {error}
        </small>
      )}
    </label>
  );
}
function Select({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      <ChevronDown className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
    </div>
  );
}
function Toast({ notice, close }: { notice: Exclude<Notice, null>; close: () => void }) {
  return (
    <div
      role={notice.kind === 'error' ? 'alert' : 'status'}
      className={`fixed bottom-5 left-1/2 z-50 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-2xl border bg-white px-4 py-3 text-sm font-bold shadow-xl ${notice.kind === 'error' ? 'border-red-100 text-red-700' : 'border-emerald-100 text-emerald-700'}`}
    >
      <span>{notice.message}</span>
      <button type="button" onClick={close} aria-label="بستن پیام" className="text-current opacity-60">
        ×
      </button>
    </div>
  );
}
