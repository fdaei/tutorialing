'use client';

import { localized, isDefaultLocale, translate } from '@/lib/i18n';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError, apiMessage, type EducationalLanguage } from '@/lib/api';
import { useTranslations } from '@/components/shared/locale-provider';
import { PACKAGE_TIERS } from '@lingospeak/contracts';

type Role = 'student' | 'teacher' | 'admin';

type Props = { role: Role; section: string; endpoint: string };
type Localized = { fa: boolean };
type UploadResponse = { fileId: string; uploadUrl: string };

const tr = (fa: boolean, persian: string, english: string) => localized({ fa: persian, en: english }, fa);
const value = (form: FormData, key: string) => String(form.get(key) ?? '').trim();
const numeric = (form: FormData, key: string, fallback = 0) => {
  const out = Number(form.get(key));
  return Number.isFinite(out) ? out : fallback;
};
const list = (form: FormData, key: string) =>
  value(form, key)
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

async function sha256(file: File) {
  const data = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(data)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const allowedUploadTypes = ['image/jpeg', 'image/png', 'application/pdf', 'video/mp4', 'video/webm', 'video/quicktime'];

async function uploadFile(file: File, purpose: string, fa: boolean) {
  if (!allowedUploadTypes.includes(file.type)) {
    throw new Error(translate(fa, 'legacyUnsupportedFileFormatUsePDFJPGOrPNG'));
  }
  if (file.size > 50 * 1024 * 1024) {
    throw new Error(translate(fa, 'legacyTheFileMustNotBeLargerThan50'));
  }
  const checksum = await sha256(file);
  const upload = await api<UploadResponse>('/files/uploads', {
    method: 'POST',
    body: JSON.stringify({ originalName: file.name, mimeType: file.type, size: file.size, checksum, purpose }),
  });
  let uploadedToStorage = false;
  try {
    const response = await fetch(upload.uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'content-type': file.type, 'x-amz-meta-checksum': checksum },
    });
    uploadedToStorage = response.ok;
  } catch {
    uploadedToStorage = false;
  }
  if (!uploadedToStorage) {
    await api(`/files/uploads/${upload.fileId}/content`, {
      method: 'POST',
      headers: { 'content-type': file.type, 'x-content-checksum': checksum },
      body: file,
    });
  }
  await api(`/files/${upload.fileId}/complete`, { method: 'POST' });
  return upload.fileId;
}

function useAction(endpoint: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (task: () => Promise<unknown>) => task(),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [endpoint] }),
        queryClient.invalidateQueries({ queryKey: ['panel-me'] }),
      ]);
    },
  });
}

function Status({ error, ok, fa }: { error: unknown; ok: boolean } & Localized) {
  if (error) {
    const fields = error instanceof ApiError ? Object.entries(error.details.fieldErrors ?? {}) : [];
    return (
      <div role="alert" className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
        <p className="font-black">{apiMessage(error, translate(fa, 'legacyTheOperationFailed'))}</p>
        {fields.length > 0 && (
          <ul className="mt-2 list-inside list-disc space-y-1">
            {fields.map(([field, message]) => (
              <li key={field}>
                <span className="font-bold">{field}:</span> {message}
              </li>
            ))}
          </ul>
        )}
        {error instanceof ApiError && error.details.requestId && (
          <p className="mt-2 text-xs text-red-700">
            {translate(fa, 'legacyRequestID')}:{' '}
            <span className="font-mono" dir="ltr">
              {error.details.requestId}
            </span>
          </p>
        )}
      </div>
    );
  }
  if (ok)
    return (
      <p role="status" className="mt-3 rounded-2xl bg-lavender p-3 text-sm font-bold text-purple">
        {translate(fa, 'legacySavedSuccessfully')}
      </p>
    );
  return null;
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-7 rounded-3xl border hairline bg-white p-5 shadow-soft">
      <h3 className="text-lg font-black">{title}</h3>
      {children}
    </section>
  );
}

function Field({
  label,
  error,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold">{label}</span>
      <input
        {...props}
        aria-invalid={Boolean(error)}
        aria-describedby={error && `${props.name}-error`}
        className={`w-full rounded-2xl border px-4 py-3 outline-none transition focus:ring-4 ${error ? 'border-red-400 bg-red-50/30 focus:border-red-500 focus:ring-red-100' : 'hairline focus:border-purple focus:ring-violet/15'}`}
      />
      {error && (
        <span id={`${props.name}-error`} className="mt-1.5 block text-xs font-bold text-red-600">
          {error}
        </span>
      )}
    </label>
  );
}

function Area({
  label,
  error,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold">{label}</span>
      <textarea
        {...props}
        aria-invalid={Boolean(error)}
        aria-describedby={error && `${props.name}-error`}
        className={`min-h-28 w-full rounded-2xl border px-4 py-3 outline-none transition focus:ring-4 ${error ? 'border-red-400 bg-red-50/30 focus:border-red-500 focus:ring-red-100' : 'hairline focus:border-purple focus:ring-violet/15'}`}
      />
      {error && (
        <span id={`${props.name}-error`} className="mt-1.5 block text-xs font-bold text-red-600">
          {error}
        </span>
      )}
    </label>
  );
}

function Select({ label, name, children }: { label: string; name: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold">{label}</span>
      <select name={name} className="w-full rounded-2xl border hairline bg-white px-4 py-3">
        {children}
      </select>
    </label>
  );
}

type RecordValue = Record<string, unknown>;
type Option = { value: string; label: string };
const isRecord = (input: unknown): input is RecordValue =>
  typeof input === 'object' && input !== null && !Array.isArray(input);
const rows = (input: unknown): RecordValue[] =>
  Array.isArray(input)
    ? input.filter(isRecord)
    : isRecord(input) && Array.isArray(input.data)
      ? input.data.filter(isRecord)
      : [];
const stringValue = (input: unknown) => (typeof input === 'string' ? input : '');
const nested = (input: unknown, key: string) =>
  isRecord(input) && isRecord(input[key]) ? (input[key] as RecordValue) : undefined;
const localizedDate = (input: unknown, fa: boolean) => {
  if (typeof input !== 'string') return '';
  const date = new Date(input);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat(translate(fa, 'commercepricingManagerEnUS2'), {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date)
    : '';
};

function EntitySelect({
  name,
  label,
  endpoint,
  options,
  fa,
}: {
  name: string;
  label: string;
  endpoint: string;
  options: (data: unknown) => Option[];
  fa: boolean;
}) {
  const query = useQuery({ queryKey: ['entity-options', endpoint], queryFn: () => api<unknown>(endpoint) }),
    items = query.data ? options(query.data) : [];
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold">{label}</span>
      <select
        name={name}
        required
        disabled={query.isLoading || query.isError || !items.length}
        defaultValue=""
        className="w-full rounded-2xl border hairline bg-white px-4 py-3 disabled:bg-[#f4f5f8] disabled:text-muted"
      >
        <option value="" disabled>
          {query.isLoading
            ? translate(fa, 'legacyLoadingOptions')
            : query.isError
              ? translate(fa, 'legacyCouldNotLoadOptions')
              : !items.length
                ? translate(fa, 'legacyNoOptionsAvailable')
                : translate(fa, 'legacyChooseAnOption')}
        </option>
        {items.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
      {query.isError && (
        <button type="button" onClick={() => query.refetch()} className="mt-2 text-xs font-bold text-purple underline">
          {translate(fa, 'legacyTryAgain')}
        </button>
      )}
    </label>
  );
}

function AssignmentSelect({ fa }: { fa: boolean }) {
  return (
    <EntitySelect
      name="assignmentId"
      label={translate(fa, 'legacyAssignment')}
      endpoint="/learning/plans"
      fa={fa}
      options={(data) =>
        rows(data).flatMap((plan) =>
          Array.isArray(plan.assignments)
            ? plan.assignments
                .filter(isRecord)
                .filter((assignment) => assignment.status !== 'submitted')
                .map((assignment) => ({
                  value: stringValue(assignment.id),
                  label: `${stringValue(assignment.title) || translate(fa, 'legacyUntitledAssignment')} — ${stringValue(plan.title) || translate(fa, 'legacyLearningPlan')}${assignment.dueAt ? ` · ${localizedDate(assignment.dueAt, fa)}` : ''}`,
                }))
                .filter((option) => option.value)
            : [],
        )
      }
    />
  );
}
function LearningPlanSelect({ fa }: { fa: boolean }) {
  return (
    <EntitySelect
      name="planId"
      label={translate(fa, 'legacylearningPlan2')}
      endpoint="/learning/plans"
      fa={fa}
      options={(data) =>
        rows(data)
          .map((plan) => {
            const student = nested(plan, 'student');
            return {
              value: stringValue(plan.id),
              label: [
                stringValue(plan.title) || translate(fa, 'legacyUntitledPlan'),
                stringValue(student?.name) || translate(fa, 'legacyStudent'),
              ].join(' — '),
            };
          })
          .filter((option) => option.value)
      }
    />
  );
}
function StudentSelect({ fa }: { fa: boolean }) {
  return (
    <EntitySelect
      name="studentId"
      label={translate(fa, 'legacystudent2')}
      endpoint="/bookings/students"
      fa={fa}
      options={(data) =>
        rows(data)
          .filter(
            (student) =>
              !Array.isArray(student.bookings) ||
              student.bookings.some((booking) => isRecord(booking) && booking.status === 'COMPLETED'),
          )
          .map((student) => ({
            value: stringValue(student.id),
            label: [stringValue(student.name) || translate(fa, 'legacyUnnamed'), stringValue(student.phone)]
              .filter(Boolean)
              .join(' — '),
          }))
          .filter((option) => option.value)
      }
    />
  );
}
function BookingSelect({ fa }: { fa: boolean }) {
  return (
    <EntitySelect
      name="bookingId"
      label={translate(fa, 'legacyBookedClass')}
      endpoint="/bookings/me"
      fa={fa}
      options={(data) =>
        rows(data)
          .filter((booking) => booking.status === 'CONFIRMED')
          .map((booking) => {
            const student = nested(booking, 'student');
            return {
              value: stringValue(booking.id),
              label: `${stringValue(student?.name) || stringValue(student?.phone) || translate(fa, 'legacystudent3')} — ${localizedDate(booking.startsAt, fa)}`,
            };
          })
          .filter((option) => option.value)
      }
    />
  );
}
function AdminUserSelect({ fa }: { fa: boolean }) {
  return (
    <EntitySelect
      name="userId"
      label={translate(fa, 'legacyUser')}
      endpoint="/admin/users?page=1"
      fa={fa}
      options={(data) =>
        rows(data)
          .map((user) => ({
            value: stringValue(user.id),
            label: [
              stringValue(user.name) || translate(fa, 'legacyunnamed2'),
              stringValue(user.phone),
              stringValue(user.email),
            ]
              .filter(Boolean)
              .join(' — '),
          }))
          .filter((option) => option.value)
      }
    />
  );
}
function TeacherApplicationSelect({ fa }: { fa: boolean }) {
  const { locale } = useTranslations();
  return (
    <EntitySelect
      name="teacherId"
      label={translate(fa, 'legacyTeacherApplication')}
      endpoint="/admin/teacher-applications"
      fa={fa}
      options={(data) =>
        rows(data)
          .map((teacher) => {
            const user = nested(teacher, 'user');
            return {
              value: stringValue(teacher.id),
              label: [
                localized({ fa: stringValue(teacher.nameFa), en: stringValue(teacher.nameEn) }, locale),
                stringValue(user?.phone),
                stringValue(teacher.status),
              ]
                .filter(Boolean)
                .join(' — '),
            };
          })
          .filter((option) => option.value)
      }
    />
  );
}
function ApprovedTeacherSelect({ fa }: { fa: boolean }) {
  const { locale } = useTranslations();
  return (
    <EntitySelect
      name="teacherId"
      label={translate(fa, 'legacyTeacher')}
      endpoint="/teachers?limit=50"
      fa={fa}
      options={(data) =>
        rows(data)
          .map((teacher) => ({
            value: stringValue(teacher.id),
            label: [
              localized({ fa: stringValue(teacher.nameFa), en: stringValue(teacher.nameEn) }, locale),
              stringValue(teacher.specialties),
            ]
              .filter(Boolean)
              .join(' — '),
          }))
          .filter((option) => option.value)
      }
    />
  );
}
function PaymentSelect({ fa }: { fa: boolean }) {
  const { locale } = useTranslations();
  return (
    <EntitySelect
      name="paymentId"
      label={translate(fa, 'legacyPayment')}
      endpoint="/admin/payments"
      fa={fa}
      options={(data) =>
        rows(data)
          .filter((payment) => ['PAID', 'PARTIALLY_REFUNDED'].includes(stringValue(payment.status)))
          .map((payment) => {
            const user = nested(payment, 'user'),
              amount =
                typeof payment.amount === 'number'
                  ? new Intl.NumberFormat(translate(locale, 'commercepricingManagerEnUS2')).format(payment.amount)
                  : '';
            return {
              value: stringValue(payment.id),
              label: [
                stringValue(user?.name) || stringValue(user?.phone) || translate(fa, 'legacyuser2'),
                amount && localized({ fa: `${amount} تومان`, en: `${amount} IRR` }, locale),
                localizedDate(payment.createdAt, fa),
                stringValue(payment.status),
              ]
                .filter(Boolean)
                .join(' — '),
            };
          })
          .filter((option) => option.value)
      }
    />
  );
}

function Submit({ busy, fa, children }: { busy: boolean; children: React.ReactNode } & Localized) {
  return (
    <button
      disabled={busy}
      className="mt-4 rounded-full bg-gradient-to-r from-blue to-purple px-6 py-3 font-black text-white shadow-lg shadow-purple/15 transition hover:-translate-y-0.5 disabled:opacity-50"
    >
      {busy ? translate(fa, 'legacyWorking') : children}
    </button>
  );
}

export function PanelActions({ role, section, endpoint }: Props) {
  const { locale } = useTranslations();
  const fa = isDefaultLocale(locale);
  if (role === 'student') return <StudentActions section={section} endpoint={endpoint} fa={fa} />;
  if (role === 'teacher') return <TeacherActions section={section} endpoint={endpoint} fa={fa} />;
  return <AdminActions section={section} endpoint={endpoint} fa={fa} />;
}

function StudentActions({ section, endpoint, fa }: Omit<Props, 'role'> & Localized) {
  const { locale } = useTranslations();
  const action = useAction(endpoint);
  if (section === 'profile')
    return (
      <Shell title={translate(fa, 'legacyCompleteProfile')}>
        <form
          className="mt-4 grid gap-4 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            action.mutate(() =>
              api('/users/me', {
                method: 'PUT',
                body: JSON.stringify({
                  name: value(form, 'name'),
                  email: value(form, 'email') || undefined,
                  locale: value(form, 'locale') || translate(locale, 'panelpanelActionsEn'),
                  timezone: value(form, 'timezone') || 'Asia/Tehran',
                }),
              }),
            );
          }}
        >
          <Field name="name" label={translate(fa, 'legacyName')} required />
          <Field name="email" label={translate(fa, 'legacyEmail')} type="email" dir="ltr" />
          <Select name="locale" label={translate(fa, 'legacyInterfaceLanguage')}>
            <option value="fa">فارسی</option>
            <option value="en">English</option>
          </Select>
          <Field name="timezone" label={translate(fa, 'legacyTimezone')} defaultValue="Asia/Tehran" dir="ltr" />
          <div className="md:col-span-2">
            <Submit fa={fa} busy={action.isPending}>
              {translate(fa, 'legacySaveProfile')}
            </Submit>
          </div>
        </form>
        <Status fa={fa} error={action.error} ok={action.isSuccess} />
      </Shell>
    );
  if (section === 'tickets') return <TicketForm endpoint={endpoint} fa={fa} />;
  if (section === 'plan')
    return (
      <Shell title={translate(fa, 'legacySubmitAssignment')}>
        <form
          className="mt-4 grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            action.mutate(() =>
              api(`/learning/assignments/${value(form, 'assignmentId')}/submit`, {
                method: 'POST',
                body: JSON.stringify({ submission: value(form, 'submission') }),
              }),
            );
          }}
        >
          <AssignmentSelect fa={fa} />
          <Area name="submission" label={translate(fa, 'legacyResponse')} required />
          <Submit fa={fa} busy={action.isPending}>
            {translate(fa, 'legacySubmitResponse')}
          </Submit>
        </form>
        <Status fa={fa} error={action.error} ok={action.isSuccess} />
      </Shell>
    );
  return null;
}

function TeacherActions({ section, endpoint, fa }: Omit<Props, 'role'> & Localized) {
  const action = useAction(endpoint);
  if (['profile', 'languages', 'specialties'].includes(section))
    return <TeacherApplicationForm endpoint={endpoint} fa={fa} />;
  if (section === 'video') return <TeacherIntroVideo endpoint={endpoint} fa={fa} />;
  if (section === 'verification') return <TeacherFiles endpoint={endpoint} fa={fa} />;

  if (section === 'availability')
    return (
      <div className="grid gap-5 xl:grid-cols-3">
        <Shell title={translate(fa, 'legacyWeeklyRule')}>
          <form
            className="mt-4 grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              action.mutate(() =>
                api('/availability/me/rules', {
                  method: 'PUT',
                  body: JSON.stringify({
                    rules: [
                      {
                        weekday: numeric(form, 'weekday'),
                        startMinute: numeric(form, 'startMinute', 540),
                        endMinute: numeric(form, 'endMinute', 1020),
                        timezone: value(form, 'timezone') || 'Asia/Tehran',
                      },
                    ],
                  }),
                }),
              );
            }}
          >
            <Field
              name="weekday"
              label={translate(fa, 'legacyWeekday06')}
              type="number"
              min={0}
              max={6}
              defaultValue={6}
            />
            <Field
              name="startMinute"
              label={translate(fa, 'legacyStartMinuteOfDay')}
              type="number"
              min={0}
              max={1440}
              defaultValue={540}
            />
            <Field
              name="endMinute"
              label={translate(fa, 'legacyEndMinuteOfDay')}
              type="number"
              min={0}
              max={1440}
              defaultValue={1020}
            />
            <Field name="timezone" label={translate(fa, 'legacytimezone2')} defaultValue="Asia/Tehran" dir="ltr" />
            <Submit fa={fa} busy={action.isPending}>
              {translate(fa, 'legacySaveRule')}
            </Submit>
          </form>
          <Status fa={fa} error={action.error} ok={action.isSuccess} />
        </Shell>
        <Shell title={translate(fa, 'legacyDateOverride')}>
          <form
            className="mt-4 grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              action.mutate(() =>
                api('/availability/me/overrides', {
                  method: 'POST',
                  body: JSON.stringify({
                    date: value(form, 'date'),
                    available: form.get('available') === 'on',
                    startMinute: numeric(form, 'startMinute'),
                    endMinute: numeric(form, 'endMinute'),
                    reason: value(form, 'reason') || undefined,
                  }),
                }),
              );
            }}
          >
            <Field name="date" label={translate(fa, 'legacyDate')} type="date" required />
            <label className="flex gap-2 text-sm font-bold">
              <input name="available" type="checkbox" defaultChecked />
              {translate(fa, 'legacyAvailable')}
            </label>
            <Field
              name="startMinute"
              label={translate(fa, 'legacyStartMinute')}
              type="number"
              min={0}
              max={1440}
              defaultValue={540}
            />
            <Field
              name="endMinute"
              label={translate(fa, 'legacyEndMinute')}
              type="number"
              min={0}
              max={1440}
              defaultValue={1020}
            />
            <Field name="reason" label={translate(fa, 'legacyReason')} />
            <Submit fa={fa} busy={action.isPending}>
              {translate(fa, 'legacySaveOverride')}
            </Submit>
          </form>
        </Shell>
        <Shell title={translate(fa, 'legacyBlockTimeRange')}>
          <form
            className="mt-4 grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              action.mutate(() =>
                api('/availability/me/blocks', {
                  method: 'POST',
                  body: JSON.stringify({
                    startsAt: new Date(value(form, 'startsAt')).toISOString(),
                    endsAt: new Date(value(form, 'endsAt')).toISOString(),
                    reason: value(form, 'reason') || undefined,
                  }),
                }),
              );
            }}
          >
            <Field name="startsAt" label={translate(fa, 'legacyStartsAt')} type="datetime-local" required />
            <Field name="endsAt" label={translate(fa, 'legacyEndsAt')} type="datetime-local" required />
            <Field name="reason" label={translate(fa, 'legacyreason2')} />
            <Submit fa={fa} busy={action.isPending}>
              {translate(fa, 'legacyBlockPeriod')}
            </Submit>
          </form>
          <Status fa={fa} error={action.error} ok={action.isSuccess} />
        </Shell>
      </div>
    );
  if (section === 'packages') return <PackageForm endpoint={endpoint} fa={fa} />;
  if (section === 'plans') return <PlanForm endpoint={endpoint} fa={fa} />;
  if (section === 'classes') return <ClassActions endpoint={endpoint} fa={fa} />;
  if (section === 'tickets') return <TicketForm endpoint={endpoint} fa={fa} />;
  return null;
}

function TeacherIntroVideo({ endpoint, fa }: { endpoint: string } & Localized) {
  const action = useAction(endpoint),
    application = useQuery({
      queryKey: [endpoint],
      queryFn: () => api<{ introVideoKey?: string; introVideoFileId?: string }>(endpoint),
    });
  const preview = useQuery({
    queryKey: ['teacher-intro-preview', application.data?.introVideoFileId],
    queryFn: () => api<{ url: string }>(`/files/${application.data!.introVideoFileId}/download`),
    enabled: Boolean(application.data?.introVideoFileId),
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <Shell title={translate(fa, 'legacyIntroductionVideo')}>
      <p className="mt-2 text-sm leading-7 text-muted">{translate(fa, 'legacyUploadAnMP4WebMOrMOVVideoUp')}</p>
      <p className="mt-3 rounded-xl bg-[#f5f6fa] p-3 text-sm">
        {application.data?.introVideoKey
          ? translate(fa, 'legacyAnIntroductionVideoIsSaved')
          : translate(fa, 'legacyNoIntroductionVideoHasBeenUploaded')}
      </p>
      {preview.data?.url && (
        <div className="mt-4 overflow-hidden rounded-2xl border hairline">
          <video controls preload="metadata" className="max-h-96 w-full bg-black" src={preview.data.url} />
          <div className="flex items-center gap-3 bg-slate-100 p-4">
            <span className="text-xs font-bold text-slate-500">01:23</span>
            <div className="relative h-2 flex-1 rounded-full bg-slate-300">
              <div className="absolute inset-y-0 start-0 w-1/3 rounded-full bg-blue"></div>
            </div>
            <span className="text-xs font-bold text-slate-500">05:00</span>
          </div>
        </div>
      )}
      <form
        className="mt-4"
        onSubmit={async (event) => {
          event.preventDefault();
          const element = event.currentTarget,
            form = new FormData(element),
            file = form.get('file');
          if (!(file instanceof File) || !file.size) return;
          setBusy(true);
          setError('');
          try {
            const fileId = await uploadFile(file, 'teacher-intro-video', fa);
            await action.mutateAsync(() =>
              api('/teacher/profile/intro-video', { method: 'PUT', body: JSON.stringify({ fileId }) }),
            );
            element.reset();
          } catch (reason) {
            setError(apiMessage(reason, translate(fa, 'legacyVideoUploadFailed')));
          } finally {
            setBusy(false);
          }
        }}
      >
        <input
          name="file"
          type="file"
          accept=".mp4,.webm,.mov"
          required
          className="w-full rounded-xl border hairline p-3"
        />
        <Submit fa={fa} busy={busy || action.isPending}>
          {translate(fa, 'legacySaveIntroductionVideo')}
        </Submit>
      </form>
      {error && (
        <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-red-800">
          {error}
        </p>
      )}
      <Status fa={fa} error={action.error} ok={action.isSuccess} />
    </Shell>
  );
}

function TeacherApplicationForm({ endpoint, fa }: { endpoint: string } & Localized) {
  const { locale } = useTranslations();
  const action = useAction(endpoint);
  const languages = useQuery({ queryKey: ['languages'], queryFn: () => api<EducationalLanguage[]>('/languages') });
  const application = useQuery({
    queryKey: [endpoint],
    queryFn: () =>
      api<{
        nameFa?: string;
        nameEn?: string;
        bioFa?: string;
        bioEn?: string;
        specialties?: string[];
        experienceYears?: number;
        languageLinks?: { languageId: string; levels?: string[] }[];
      }>(endpoint),
  });
  const current = application.data;
  const fieldError = (name: string) =>
    action.error instanceof ApiError ? action.error.details.fieldErrors?.[name] : undefined;
  return (
    <Shell title={translate(fa, 'legacyTeacherApplicationProfile')}>
      <p className="mt-2 text-sm leading-7 text-muted">
        {translate(fa, 'legacyEnterNamesAndBiographiesInBothLanguagesUse')}
      </p>
      <form
        key={current ? 'loaded' : 'loading'}
        className="mt-4 grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          action.mutate(() =>
            api('/teacher/application', {
              method: 'POST',
              body: JSON.stringify({
                nameFa: value(form, 'nameFa'),
                nameEn: value(form, 'nameEn'),
                bioFa: value(form, 'bioFa'),
                bioEn: value(form, 'bioEn'),
                specialties: list(form, 'specialties'),
                languageIds: form.getAll('languageIds').map(String),
                levels: list(form, 'levels'),
                experienceYears: numeric(form, 'experienceYears'),
              }),
            }),
          );
        }}
      >
        <Field
          name="nameFa"
          label={translate(fa, 'legacyPersianName')}
          defaultValue={current?.nameFa}
          minLength={2}
          maxLength={80}
          error={fieldError('nameFa')}
          required
        />
        <Field
          name="nameEn"
          label={translate(fa, 'legacyEnglishName')}
          defaultValue={current?.nameEn}
          minLength={2}
          maxLength={80}
          error={fieldError('nameEn')}
          required
          dir="ltr"
        />
        <Area
          name="bioFa"
          label={translate(fa, 'legacyPersianBiographyAtLeast40Characters')}
          defaultValue={current?.bioFa}
          minLength={40}
          maxLength={3000}
          error={fieldError('bioFa')}
          required
        />
        <Area
          name="bioEn"
          label={translate(fa, 'legacyEnglishBiographyAtLeast40Characters')}
          defaultValue={current?.bioEn}
          minLength={40}
          maxLength={3000}
          error={fieldError('bioEn')}
          required
          dir="ltr"
        />
        <Field
          name="specialties"
          label={translate(fa, 'legacySpecialtiesEGWritingSpeaking')}
          defaultValue={current?.specialties?.join(',') || 'writing,speaking'}
          error={fieldError('specialties')}
          dir="ltr"
          required
        />
        <Field
          name="levels"
          label={translate(fa, 'legacyLevelsEGA1A2B1')}
          defaultValue={
            current?.languageLinks
              ?.flatMap((link) => link.levels ?? [])
              .filter((level, index, all) => all.indexOf(level) === index)
              .join(',') || 'A1,A2,B1,B2,C1'
          }
          error={fieldError('levels')}
          dir="ltr"
        />
        <fieldset className={fieldError('languageIds') ? 'rounded-2xl border border-red-300 bg-red-50/30 p-3' : ''}>
          <legend className="mb-2 text-sm font-bold">{translate(fa, 'legacyLanguagesYouTeachSelectAtLeastOne')}</legend>
          <div className="flex flex-wrap gap-2">
            {languages.data?.map((language) => (
              <label key={language.id} className="rounded-xl border hairline bg-white px-3 py-2">
                <input
                  name="languageIds"
                  value={language.id}
                  type="checkbox"
                  className="mx-2"
                  defaultChecked={current?.languageLinks?.some((link) => link.languageId === language.id)}
                />
                {language.flag} {localized({ fa: language.nameFa, en: language.nameEn }, locale)}
              </label>
            ))}
          </div>
          {fieldError('languageIds') && (
            <span role="alert" className="mt-2 block text-xs font-bold text-red-600">
              {fieldError('languageIds')}
            </span>
          )}
        </fieldset>
        <Field
          name="experienceYears"
          label={translate(fa, 'legacyYearsOfExperienceEG3')}
          type="number"
          min={0}
          max={60}
          step={1}
          defaultValue={current?.experienceYears ?? 3}
          error={fieldError('experienceYears')}
        />
        <Submit fa={fa} busy={action.isPending || languages.isLoading}>
          {translate(fa, 'legacySaveApplication')}
        </Submit>
      </form>
      <Status fa={fa} error={action.error} ok={action.isSuccess} />
    </Shell>
  );
}

function TeacherFiles({ endpoint, fa }: { endpoint: string } & Localized) {
  const action = useAction(endpoint);
  const application = useQuery({
    queryKey: [endpoint],
    queryFn: () =>
      api<{
        verificationItems?: { id: string; kind: string; status: string; rejectionReason?: string; note?: string }[];
      }>(endpoint),
  });
  const [busy, setBusy] = useState(false);
  const [fileError, setFileError] = useState('');
  const uploadedKinds = new Set(
    (application.data?.verificationItems ?? [])
      .filter((item) => ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED'].includes(item.status))
      .map((item) => item.kind.toLowerCase()),
  );
  const documentsReady = uploadedKinds.has('identity') && uploadedKinds.has('certificate');
  return (
    <Shell title={translate(fa, 'legacyDocumentsAndIntroductionVideo')}>
      <form
        className="mt-4 grid gap-4"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setFileError('');
          const formElement = event.currentTarget;
          const form = new FormData(formElement);
          try {
            const file = form.get('file');
            if (!(file instanceof File) || !file.size) throw new Error(translate(fa, 'legacySelectAFileFirst'));
            const kind = value(form, 'kind');
            const fileId = await uploadFile(
              file,
              kind === 'intro-video' ? 'teacher-intro-video' : 'teacher-verification',
              fa,
            );
            await action.mutateAsync(() =>
              kind === 'intro-video'
                ? api('/teacher/profile/intro-video', { method: 'PUT', body: JSON.stringify({ fileId }) })
                : api('/teacher/application/documents', { method: 'POST', body: JSON.stringify({ kind, fileId }) }),
            );
            formElement.reset();
          } catch (error) {
            setFileError(apiMessage(error, translate(fa, 'legacyUploadFailedCheckTheConnectionAndFileType')));
          } finally {
            setBusy(false);
          }
        }}
      >
        <Select name="kind" label={translate(fa, 'legacyDocumentType')}>
          <option value="identity">{translate(fa, 'legacyIdentity')}</option>
          <option value="certificate">{translate(fa, 'legacyCertificate')}</option>
          <option value="experience">{translate(fa, 'legacyExperience')}</option>
          <option value="demo-lesson">{translate(fa, 'legacyTeachingDemo')}</option>
          <option value="intro-video">{translate(fa, 'legacyintroductionVideo2')}</option>
        </Select>
        <label className="block">
          <span className="mb-2 block text-sm font-bold">{translate(fa, 'legacyFileMaximum50MB')}</span>
          <input
            name="file"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.mp4,.webm,.mov"
            className="w-full rounded-2xl border hairline p-3"
            required
          />
        </label>
        <Submit fa={fa} busy={busy || action.isPending}>
          {translate(fa, 'legacyUploadAndAttach')}
        </Submit>
      </form>
      <p
        className={`mt-5 rounded-xl p-3 text-sm ${documentsReady ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}
      >
        {documentsReady
          ? translate(fa, 'legacyBothRequiredDocumentsAreUploadedSubmitYourApplication')
          : translate(fa, 'legacyUploadOneIdentityDocumentAndOneTeachingCertificate')}
      </p>
      <div className="mt-3 grid gap-2">
        {(application.data?.verificationItems ?? []).map((item) => (
          <div key={item.id} className="flex items-center justify-between rounded-xl border hairline p-3 text-sm">
            <span>{documentKind(item.kind, fa)}</span>
            <span className="font-bold">{documentStatus(item.status, fa)}</span>
          </div>
        ))}
      </div>
      {(application.data?.verificationItems ?? [])
        .filter((item) => ['REJECTED', 'NEEDS_REVISION'].includes(item.status))
        .map((item) => (
          <form
            key={item.id}
            className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4"
            onSubmit={async (event) => {
              event.preventDefault();
              const element = event.currentTarget,
                form = new FormData(element),
                file = form.get('file');
              if (!(file instanceof File) || !file.size) return;
              setBusy(true);
              setFileError('');
              try {
                const fileId = await uploadFile(file, 'teacher-verification', fa);
                await action.mutateAsync(() =>
                  api(`/teacher/application/documents/${item.id}/resubmit`, {
                    method: 'POST',
                    body: JSON.stringify({ fileId }),
                  }),
                );
                element.reset();
              } catch (error) {
                setFileError(apiMessage(error, translate(fa, 'legacyDocumentResubmissionFailed')));
              } finally {
                setBusy(false);
              }
            }}
          >
            <strong>
              {translate(fa, 'legacyNeedsRevision')}
              {item.kind}
            </strong>
            <p className="my-2 text-sm text-amber-900">
              {item.rejectionReason || item.note || translate(fa, 'legacyUploadACorrectedVersion')}
            </p>
            <input
              name="file"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              required
              className="w-full rounded-xl border bg-white p-2"
            />
            <Submit fa={fa} busy={busy || action.isPending}>
              {translate(fa, 'legacyUploadCorrectedFileAndResubmit')}
            </Submit>
          </form>
        ))}
      <form
        className="mt-2"
        onSubmit={(event) => {
          event.preventDefault();
          action.mutate(() => api('/teacher/application/submit', { method: 'POST' }));
        }}
      >
        <Submit fa={fa} busy={action.isPending || application.isLoading || !documentsReady}>
          {translate(fa, 'legacySubmitForReview')}
        </Submit>
      </form>
      {fileError && (
        <p role="alert" className="mt-3 rounded-2xl bg-red-50 p-3 text-sm text-red-800">
          {fileError}
        </p>
      )}
      <Status fa={fa} error={action.error} ok={action.isSuccess} />
    </Shell>
  );
}

function documentKind(kind: string, fa: boolean) {
  const map: Record<string, [string, string]> = {
    identity: ['مدرک هویتی', 'Identity'],
    certificate: ['مدرک آموزشی', 'Teaching certificate'],
    experience: ['سابقه کاری', 'Experience'],
    ['demo-lesson']: ['دموی تدریس', 'Teaching demo'],
  };
  return (map[kind] ?? [kind, kind])[localized({ fa: 0, en: 1 }, fa)];
}
function documentStatus(status: string, fa: boolean) {
  const map: Record<string, [string, string]> = {
    SUBMITTED: ['ارسال‌شده', 'Submitted'],
    UNDER_REVIEW: ['در حال بررسی', 'Under review'],
    APPROVED: ['تأییدشده', 'Approved'],
    REJECTED: ['ردشده', 'Rejected'],
    NEEDS_REVISION: ['نیازمند اصلاح', 'Needs revision'],
  };
  return (map[status] ?? [status, status])[localized({ fa: 0, en: 1 }, fa)];
}

function TicketForm({ endpoint, fa }: { endpoint: string } & Localized) {
  const action = useAction(endpoint);
  return (
    <Shell title={translate(fa, 'legacySupportTicket')}>
      <form
        className="mt-4 grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          action.mutate(() =>
            api('/support/tickets', {
              method: 'POST',
              body: JSON.stringify({
                subject: value(form, 'subject'),
                category: value(form, 'category') || 'general',
                priority: value(form, 'priority') || 'normal',
                body: value(form, 'body'),
              }),
            }),
          );
        }}
      >
        <Field name="subject" label={translate(fa, 'legacySubject')} required />
        <Field name="category" label={translate(fa, 'legacyCategory')} defaultValue="general" dir="ltr" />
        <Select name="priority" label={translate(fa, 'legacyPriority')}>
          <option value="normal">{translate(fa, 'legacyNormal')}</option>
          <option value="high">{translate(fa, 'legacyHigh')}</option>
          <option value="urgent">{translate(fa, 'legacyUrgent')}</option>
        </Select>
        <Area name="body" label={translate(fa, 'legacyMessage')} required />
        <Submit fa={fa} busy={action.isPending}>
          {translate(fa, 'legacyCreateTicket')}
        </Submit>
      </form>
      <Status fa={fa} error={action.error} ok={action.isSuccess} />
    </Shell>
  );
}

function PackageForm({ endpoint, fa }: { endpoint: string } & Localized) {
  const action = useAction(endpoint);
  return (
    <Shell title={translate(fa, 'legacyCreateTeachingPackage')}>
      <form
        className="mt-4 grid gap-4 md:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          // The price is derived server-side from the teacher's approved lesson rate
          // and this discount, so a package cannot sell lessons at a rate that never
          // passed price review. Only the tier and the discount are chosen here.
          action.mutate(() =>
            api('/packages', {
              method: 'POST',
              body: JSON.stringify({
                titleFa: value(form, 'titleFa'),
                titleEn: value(form, 'titleEn'),
                descriptionFa: value(form, 'descriptionFa'),
                descriptionEn: value(form, 'descriptionEn'),
                credits: numeric(form, 'credits', 5),
                lessonMinutes: numeric(form, 'lessonMinutes', 60),
                discountPercent: numeric(form, 'discountPercent', 0),
              }),
            }),
          );
        }}
      >
        <Field name="titleFa" label={translate(fa, 'legacyPersianTitle')} required />
        <Field name="titleEn" label={translate(fa, 'legacyEnglishTitle')} required dir="ltr" />
        <Select name="credits" label={translate(fa, 'legacySessionsInPackage')}>
          {PACKAGE_TIERS.map((tier) => (
            <option key={tier} value={tier}>
              {tr(fa, `${tier} جلسه`, `${tier} session${tier === 1 ? '' : 's'}`)}
            </option>
          ))}
        </Select>
        <Field
          name="lessonMinutes"
          label={translate(fa, 'legacyMinutesPerLesson')}
          type="number"
          min={15}
          max={240}
          defaultValue={60}
        />
        <Field
          name="discountPercent"
          label={translate(fa, 'legacyPackageDiscount')}
          type="number"
          min={0}
          max={80}
          defaultValue={0}
        />
        <Area name="descriptionFa" label={translate(fa, 'legacyPersianDescription')} required />
        <Area name="descriptionEn" label={translate(fa, 'legacyEnglishDescription')} required dir="ltr" />
        <div className="md:col-span-2">
          <Submit fa={fa} busy={action.isPending}>
            {translate(fa, 'legacySubmitPackageForApproval')}
          </Submit>
        </div>
      </form>
      <Status fa={fa} error={action.error} ok={action.isSuccess} />
    </Shell>
  );
}

function PlanForm({ endpoint, fa }: { endpoint: string } & Localized) {
  const action = useAction(endpoint);
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Shell title={translate(fa, 'legacyCreateLearningPlan')}>
        <form
          className="mt-4 grid gap-4 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            action.mutate(() =>
              api('/learning/plans', {
                method: 'POST',
                body: JSON.stringify({
                  studentId: value(form, 'studentId'),
                  title: value(form, 'title'),
                  targetBand: numeric(form, 'targetBand', 7),
                  examDate: value(form, 'examDate') || undefined,
                  weakSkills: list(form, 'weakSkills'),
                  milestones: [{ title: value(form, 'milestone'), order: 1, dueAt: value(form, 'dueAt') || undefined }],
                }),
              }),
            );
          }}
        >
          <StudentSelect fa={fa} />
          <Field name="title" label={translate(fa, 'legacyPlanTitle')} required />
          <Field
            name="targetBand"
            label={translate(fa, 'legacyTargetBand')}
            type="number"
            step="0.5"
            min={4}
            max={9}
            defaultValue={7}
          />
          <Field name="examDate" label={translate(fa, 'legacyExamDate')} type="date" />
          <Field
            name="weakSkills"
            label={translate(fa, 'legacyWeakSkillsCommaSeparated')}
            defaultValue="writing,speaking"
            dir="ltr"
          />
          <Field name="milestone" label={translate(fa, 'legacyFirstMilestone')} required />
          <Field name="dueAt" label={translate(fa, 'legacyDueDate')} type="date" />
          <div className="md:col-span-2">
            <Submit fa={fa} busy={action.isPending}>
              {translate(fa, 'legacyCreatePlan')}
            </Submit>
          </div>
        </form>
        <Status fa={fa} error={action.error} ok={action.isSuccess} />
      </Shell>
      <Shell title={translate(fa, 'legacyAddAnAssignmentToAPlan')}>
        <form
          className="mt-4 grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            action.mutate(() =>
              api(`/learning/plans/${value(form, 'planId')}/assignments`, {
                method: 'POST',
                body: JSON.stringify({
                  title: value(form, 'assignmentTitle'),
                  instructions: value(form, 'instructions'),
                  dueAt: value(form, 'assignmentDueAt') || undefined,
                }),
              }),
            );
          }}
        >
          <LearningPlanSelect fa={fa} />
          <Field name="assignmentTitle" label={translate(fa, 'legacyAssignmentTitle')} required />
          <Area name="instructions" label={translate(fa, 'legacyInstructionsAndSubmissionDetails')} required />
          <Field name="assignmentDueAt" label={translate(fa, 'legacydueDate2')} type="date" />
          <Submit fa={fa} busy={action.isPending}>
            {translate(fa, 'legacyAddAssignment')}
          </Submit>
        </form>
        <Status fa={fa} error={action.error} ok={action.isSuccess} />
      </Shell>
    </div>
  );
}

function ClassActions({ endpoint, fa }: { endpoint: string } & Localized) {
  const action = useAction(endpoint);
  return (
    <Shell title={translate(fa, 'legacyAttendanceMeetingLinkAndClassCompletion')}>
      <form
        className="mt-4 grid gap-4 md:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          action.mutate(() =>
            api(`/bookings/${value(form, 'bookingId')}/attendance`, {
              method: 'PUT',
              body: JSON.stringify({
                student: form.get('student') === 'on',
                teacher: form.get('teacher') === 'on',
                meetingUrl: value(form, 'meetingUrl') || undefined,
              }),
            }),
          );
        }}
      >
        <BookingSelect fa={fa} />
        <Field name="meetingUrl" label={translate(fa, 'legacyMeetingURL')} type="url" dir="ltr" />
        <label className="flex gap-2">
          <input name="student" type="checkbox" />
          {translate(fa, 'legacyStudentAttended')}
        </label>
        <label className="flex gap-2">
          <input name="teacher" type="checkbox" defaultChecked />
          {translate(fa, 'legacyTeacherAttended')}
        </label>
        <div className="md:col-span-2">
          <Submit fa={fa} busy={action.isPending}>
            {translate(fa, 'legacySaveAttendance')}
          </Submit>
        </div>
      </form>
      <form
        className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          action.mutate(() => api(`/bookings/${value(form, 'bookingId')}/complete`, { method: 'POST' }));
        }}
      >
        <BookingSelect fa={fa} />
        <div>
          <Submit fa={fa} busy={action.isPending}>
            {translate(fa, 'legacyCompleteClass')}
          </Submit>
        </div>
      </form>
      <Status fa={fa} error={action.error} ok={action.isSuccess} />
    </Shell>
  );
}

function AdminActions({ section, endpoint, fa }: Omit<Props, 'role'> & Localized) {
  if (section === 'users') return <AdminUserActions endpoint={endpoint} fa={fa} />;
  if (section === 'teachers') return <AdminTeacherActions endpoint={endpoint} fa={fa} />;
  if (section === 'settings') return <AdminSettingsActions endpoint={endpoint} fa={fa} />;
  if (section === 'bookings') return <AdminBookingActions endpoint={endpoint} fa={fa} />;
  if (section === 'payments') return <AdminFinanceActions endpoint={endpoint} fa={fa} />;
  if (section === 'roles') return <AdminRoleActions endpoint={endpoint} fa={fa} />;
  if (section === 'tickets') return <TicketForm endpoint={endpoint} fa={fa} />;
  return null;
}

function AdminUserActions({ endpoint, fa }: { endpoint: string } & Localized) {
  const action = useAction(endpoint);
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Shell title={translate(fa, 'legacyCreateUser')}>
        <form
          className="mt-4 grid gap-4 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            action.mutate(() =>
              api('/admin/users', {
                method: 'POST',
                body: JSON.stringify({
                  phone: value(form, 'phone'),
                  name: value(form, 'name'),
                  email: value(form, 'email') || undefined,
                  locale: value(form, 'locale'),
                  roles: [value(form, 'role')],
                }),
              }),
            );
          }}
        >
          <Field name="phone" label={translate(fa, 'legacyPhoneNumber')} pattern="09[0-9]{9}" required dir="ltr" />
          <Field name="name" label={translate(fa, 'legacyname2')} required />
          <Field name="email" label={translate(fa, 'legacyemail2')} type="email" dir="ltr" />
          <Select name="locale" label={translate(fa, 'legacyLanguage')}>
            <option value="fa">فارسی</option>
            <option value="en">English</option>
          </Select>
          <Select name="role" label={translate(fa, 'legacyInitialRole')}>
            <RoleOptions />
          </Select>
          <div className="md:col-span-2">
            <Submit fa={fa} busy={action.isPending}>
              {translate(fa, 'legacycreateUser2')}
            </Submit>
          </div>
        </form>
        <Status fa={fa} error={action.error} ok={action.isSuccess} />
      </Shell>
      <Shell title={translate(fa, 'legacyChangeUserStatus')}>
        <form
          className="mt-4 grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            action.mutate(() =>
              api(`/admin/users/${value(form, 'userId')}/status`, {
                method: 'PATCH',
                body: JSON.stringify({ status: value(form, 'status') }),
              }),
            );
          }}
        >
          <AdminUserSelect fa={fa} />
          <Select name="status" label={translate(fa, 'legacyStatus')}>
            <option>ACTIVE</option>
            <option>SUSPENDED</option>
            <option>DELETED</option>
          </Select>
          <Submit fa={fa} busy={action.isPending}>
            {translate(fa, 'legacyUpdateStatus')}
          </Submit>
        </form>
      </Shell>
    </div>
  );
}

function AdminTeacherActions({ endpoint, fa }: { endpoint: string } & Localized) {
  const action = useAction(endpoint);
  return (
    <Shell title={translate(fa, 'legacyReviewTeacherApplication')}>
      <form
        className="mt-4 grid gap-4 md:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          action.mutate(() =>
            api(`/admin/teacher-applications/${value(form, 'teacherId')}/transition`, {
              method: 'POST',
              body: JSON.stringify({ status: value(form, 'status'), note: value(form, 'note') || undefined }),
            }),
          );
        }}
      >
        <TeacherApplicationSelect fa={fa} />
        <Select name="status" label={translate(fa, 'legacyNextStatus')}>
          <option>DOCUMENT_REVIEW</option>
          <option>INTERVIEW</option>
          <option>DEMO_REVIEW</option>
          <option>APPROVED</option>
          <option>REJECTED</option>
        </Select>
        <Area name="note" label={translate(fa, 'legacyReviewNote')} />
        <div className="md:col-span-2">
          <Submit fa={fa} busy={action.isPending}>
            {translate(fa, 'legacyApplyStatus')}
          </Submit>
        </div>
      </form>
      <Status fa={fa} error={action.error} ok={action.isSuccess} />
    </Shell>
  );
}

function AdminSettingsActions({ endpoint, fa }: { endpoint: string } & Localized) {
  const action = useAction(endpoint);
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Shell title={translate(fa, 'legacyGeneralSetting')}>
        <form
          className="mt-4 grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            action.mutate(() =>
              api(`/admin/settings/${encodeURIComponent(value(form, 'key'))}`, {
                method: 'PUT',
                body: JSON.stringify({
                  value: { value: value(form, 'settingValue') },
                  public: form.get('public') === 'on',
                }),
              }),
            );
          }}
        >
          <Field name="key" label={translate(fa, 'legacyKey')} required dir="ltr" />
          <Field name="settingValue" label={translate(fa, 'legacyValue')} required />
          <label className="flex gap-2">
            <input name="public" type="checkbox" />
            {translate(fa, 'legacyPublic')}
          </label>
          <Submit fa={fa} busy={action.isPending}>
            {translate(fa, 'legacySaveSetting')}
          </Submit>
        </form>
        <Status fa={fa} error={action.error} ok={action.isSuccess} />
      </Shell>
      <Shell title={translate(fa, 'legacyBilingualCMSPage')}>
        <form
          className="mt-4 grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            action.mutate(() =>
              api(`/admin/cms/${encodeURIComponent(value(form, 'slug'))}`, {
                method: 'PUT',
                body: JSON.stringify({
                  titleFa: value(form, 'titleFa'),
                  titleEn: value(form, 'titleEn'),
                  contentFa: { paragraphs: [value(form, 'bodyFa')] },
                  contentEn: { paragraphs: [value(form, 'bodyEn')] },
                  published: true,
                }),
              }),
            );
          }}
        >
          <Field name="slug" label="Slug" required dir="ltr" />
          <Field name="titleFa" label={translate(fa, 'legacypersianTitle2')} required />
          <Field name="titleEn" label={translate(fa, 'legacyenglishTitle2')} required dir="ltr" />
          <Area name="bodyFa" label={translate(fa, 'legacyPersianContent')} required />
          <Area name="bodyEn" label={translate(fa, 'legacyEnglishContent')} required dir="ltr" />
          <Submit fa={fa} busy={action.isPending}>
            {translate(fa, 'legacySavePage')}
          </Submit>
        </form>
      </Shell>
    </div>
  );
}

function AdminBookingActions({ endpoint, fa }: { endpoint: string } & Localized) {
  const action = useAction(endpoint);
  return (
    <Shell title={translate(fa, 'legacyAdminCalendarBlock')}>
      <form
        className="mt-4 grid gap-4 md:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          action.mutate(() =>
            api('/availability/admin/blocks', {
              method: 'POST',
              body: JSON.stringify({
                teacherId: value(form, 'teacherId'),
                startsAt: new Date(value(form, 'startsAt')).toISOString(),
                endsAt: new Date(value(form, 'endsAt')).toISOString(),
                reason: value(form, 'reason') || undefined,
              }),
            }),
          );
        }}
      >
        <ApprovedTeacherSelect fa={fa} />
        <Field name="startsAt" label={translate(fa, 'legacystartsAt2')} type="datetime-local" required />
        <Field name="endsAt" label={translate(fa, 'legacyendsAt2')} type="datetime-local" required />
        <Field name="reason" label={translate(fa, 'legacyreason3')} />
        <div className="md:col-span-2">
          <Submit fa={fa} busy={action.isPending}>
            {translate(fa, 'legacyCreateBlock')}
          </Submit>
        </div>
      </form>
      <Status fa={fa} error={action.error} ok={action.isSuccess} />
    </Shell>
  );
}

function AdminFinanceActions({ endpoint, fa }: { endpoint: string } & Localized) {
  const action = useAction(endpoint);
  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <Shell title={translate(fa, 'legacyRefund')}>
        <form
          className="mt-4 grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            action.mutate(() =>
              api(`/payments/${value(form, 'paymentId')}/refunds`, {
                method: 'POST',
                body: JSON.stringify({
                  amount: numeric(form, 'amount'),
                  reason: value(form, 'reason'),
                  idempotencyKey: crypto.randomUUID(),
                }),
              }),
            );
          }}
        >
          <PaymentSelect fa={fa} />
          <Field name="amount" label={translate(fa, 'legacyAmount')} type="number" min={1} required />
          <Field name="reason" label={translate(fa, 'legacyreason4')} required />
          <Submit fa={fa} busy={action.isPending}>
            {translate(fa, 'legacyCreateRefund')}
          </Submit>
        </form>
        <Status fa={fa} error={action.error} ok={action.isSuccess} />
      </Shell>
      <Shell title={translate(fa, 'legacyDiscountCode')}>
        <form
          className="mt-4 grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            action.mutate(() =>
              api('/payouts/discounts', {
                method: 'POST',
                body: JSON.stringify({
                  code: value(form, 'code'),
                  type: value(form, 'type'),
                  value: numeric(form, 'discountValue'),
                  maxUses: numeric(form, 'maxUses') || undefined,
                }),
              }),
            );
          }}
        >
          <Field name="code" label={translate(fa, 'legacyCode')} required dir="ltr" />
          <Select name="type" label={translate(fa, 'legacyType')}>
            <option value="percent">{translate(fa, 'legacyPercent')}</option>
            <option value="fixed">{translate(fa, 'legacyFixedAmount')}</option>
          </Select>
          <Field name="discountValue" label={translate(fa, 'legacyvalue2')} type="number" min={1} required />
          <Field name="maxUses" label={translate(fa, 'legacyMaximumUses')} type="number" min={1} />
          <Submit fa={fa} busy={action.isPending}>
            {translate(fa, 'legacyCreateDiscount')}
          </Submit>
        </form>
      </Shell>
      <Shell title={translate(fa, 'legacyGenerateWeeklyPayout')}>
        <form
          className="mt-4 grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            action.mutate(() =>
              api('/payouts/generate', {
                method: 'POST',
                body: JSON.stringify({ weekStart: value(form, 'weekStart'), weekEnd: value(form, 'weekEnd') }),
              }),
            );
          }}
        >
          <Field name="weekStart" label={translate(fa, 'legacyWeekStart')} type="date" required />
          <Field name="weekEnd" label={translate(fa, 'legacyWeekEnd')} type="date" required />
          <Submit fa={fa} busy={action.isPending}>
            {translate(fa, 'legacyGeneratePayout')}
          </Submit>
        </form>
      </Shell>
    </div>
  );
}

function AdminRoleActions({ endpoint, fa }: { endpoint: string } & Localized) {
  const action = useAction(endpoint);
  const form = (mode: 'assign' | 'revoke' | 'permission') => (
    <form
      className="mt-4 grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const userId = value(data, 'userId');
        const role = value(data, 'role');
        const request =
          mode === 'assign'
            ? api('/admin/roles', { method: 'POST', body: JSON.stringify({ userId, role }) })
            : mode === 'revoke'
              ? api('/admin/roles/revoke', { method: 'POST', body: JSON.stringify({ userId, role }) })
              : api('/admin/permissions/grant', {
                  method: 'POST',
                  body: JSON.stringify({ userId, role, permission: value(data, 'permission') }),
                });
        action.mutate(() => request);
      }}
    >
      <AdminUserSelect fa={fa} />
      <Select name="role" label={translate(fa, 'legacyRole')}>
        <RoleOptions />
      </Select>
      {mode === 'permission' && (
        <Field
          name="permission"
          label={translate(fa, 'legacyPermissionKey')}
          defaultValue="reports.read"
          required
          dir="ltr"
        />
      )}
      <Submit fa={fa} busy={action.isPending}>
        {mode === 'assign'
          ? translate(fa, 'legacyAssignRole')
          : mode === 'revoke'
            ? translate(fa, 'legacyRevokeRole')
            : translate(fa, 'legacyGrantPermission')}
      </Submit>
    </form>
  );
  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <Shell title={translate(fa, 'legacyassignRole2')}>
        {form('assign')}
        <Status fa={fa} error={action.error} ok={action.isSuccess} />
      </Shell>
      <Shell title={translate(fa, 'legacyrevokeRole2')}>{form('revoke')}</Shell>
      <Shell title={translate(fa, 'legacyGrantPermissionToUserRole')}>{form('permission')}</Shell>
    </div>
  );
}

function RoleOptions() {
  return (
    <>
      <option>STUDENT</option>
      <option>TEACHER</option>
      <option>ADMIN</option>
      <option>STAFF</option>
      <option>EXAMINER</option>
      <option>SUPPORT</option>
      <option>FINANCE</option>
    </>
  );
}
