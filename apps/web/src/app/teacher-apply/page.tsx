'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { api, ApiError, apiMessage } from '@/shared/services/api';
import type { EducationalLanguage } from '@/features/languages';
import { localePath, localized, isDefaultLocale, translate } from '@/lib/i18n';
import { useTranslations } from '@/components/shared/locale-provider';
import { Header } from '@/components/layout/site';
export default function TeacherApply() {
  const { locale } = useTranslations(),
    fa = isDefaultLocale(locale),
    router = useRouter(),
    p = (x: string) => localePath(x, locale),
    [languageIds, setLanguages] = useState<string[]>([]);
  const languages = useQuery({ queryKey: ['languages'], queryFn: () => api<EducationalLanguage[]>('/languages') });
  const submit = useMutation({
    mutationFn: async (form: HTMLFormElement) => {
      const d = new FormData(form),
        csv = (k: string) =>
          String(d.get(k) || '')
            .split(',')
            .map((x) => x.trim())
            .filter(Boolean);
      await api('/teacher/application', {
        method: 'POST',
        body: JSON.stringify({
          nameFa: d.get('nameFa'),
          nameEn: d.get('nameEn'),
          bioFa: d.get('bioFa'),
          bioEn: d.get('bioEn'),
          specialties: csv('specialties'),
          levels: csv('levels'),
          languageIds,
          experienceYears: Number(d.get('experienceYears')),
        }),
      });
      const token = await api<{ accessToken: string }>('/auth/refresh', { method: 'POST' });
      sessionStorage.setItem('access_token', token.accessToken);
    },
    onSuccess: () => router.replace(p('/teacher-panel/verification')),
  });
  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-5 py-12">
        <div className="panel-card p-7">
          <h1 className="text-3xl font-black">{translate(locale, 'teacherApplyApplyAsATeacher')}</h1>
          <p className="mt-3 text-muted">{translate(locale, 'teacherApplySignInAndCompleteTheForm')}</p>
          <form
            className="mt-7 grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              submit.mutate(e.currentTarget);
            }}
          >
            <Field name="nameFa" label="نام فارسی" required />
            <Field name="nameEn" label="نام انگلیسی" dir="ltr" required />
            <Area name="bioFa" label="بیوگرافی فارسی (حداقل ۴۰ حرف)" minLength={40} required />
            <Area name="bioEn" label="English biography (minimum 40 characters)" minLength={40} dir="ltr" required />
            <Field
              name="specialties"
              label={translate(locale, 'teacherApplySpecialtiesCommaSeparated')}
              defaultValue="writing,speaking"
              required
            />
            <Field
              name="levels"
              label={translate(locale, 'teacherApplyLevelsCommaSeparated')}
              defaultValue="A1,A2,B1,B2,C1"
            />
            <Field
              name="experienceYears"
              label={translate(locale, 'teacherApplyYearsOfExperience')}
              type="number"
              min={0}
              max={60}
              defaultValue={0}
              required
            />
            <fieldset className="sm:col-span-2">
              <legend className="mb-2 font-bold">{translate(locale, 'teacherApplyTeachingLanguages')}</legend>
              <div className="flex flex-wrap gap-2">
                {languages.data?.map((x) => (
                  <label key={x.id} className="rounded-xl border hairline px-4 py-3">
                    <input
                      type="checkbox"
                      className="mx-2"
                      checked={languageIds.includes(x.id)}
                      onChange={(e) =>
                        setLanguages((ids) => (e.target.checked ? [...ids, x.id] : ids.filter((id) => id !== x.id)))
                      }
                    />
                    {x.flag} {localized({ fa: x.nameFa, en: x.nameEn }, locale)}
                  </label>
                ))}
              </div>
            </fieldset>
            {submit.isError && (
              <div role="alert" className="sm:col-span-2 rounded-xl bg-red-50 p-4 text-red-800">
                {submit.error instanceof ApiError && submit.error.status === 401 ? (
                  <Link className="font-bold underline" href={p('/auth?next=/teacher-apply')}>
                    {translate(locale, 'teacherApplySignInFirst')}
                  </Link>
                ) : (
                  apiMessage(submit.error, translate(locale, 'teacherApplyApplicationFailed'))
                )}
              </div>
            )}
            <button
              disabled={submit.isPending || !languageIds.length}
              className="brand-gradient rounded-xl px-6 py-4 font-black text-white disabled:opacity-40 sm:col-span-2"
            >
              {submit.isPending
                ? translate(locale, 'teacherteacherFinanceSubmitting')
                : translate(locale, 'teacherApplySubmitAndContinue')}
            </button>
          </form>
        </div>
      </main>
    </>
  );
}
function Field({ label, ...p }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label>
      <span className="mb-2 block font-bold">{label}</span>
      <input {...p} className="w-full rounded-xl border hairline px-4 py-3" />
    </label>
  );
}
function Area({ label, ...p }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return (
    <label>
      <span className="mb-2 block font-bold">{label}</span>
      <textarea {...p} className="min-h-32 w-full rounded-xl border hairline px-4 py-3" />
    </label>
  );
}
