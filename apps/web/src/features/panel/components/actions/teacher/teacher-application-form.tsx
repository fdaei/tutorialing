'use client';

import { localized, translate } from '@/lib/i18n';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '@/shared/services/api';
import type { EducationalLanguage } from '@/features/languages';
import { useTranslations } from '@/components/shared/locale-provider';
import { Area, Field, Localized, Shell, Status, Submit, list, numeric, useAction, value } from '../shared/action-controls';
export function TeacherApplicationForm({ endpoint, fa }: { endpoint: string } & Localized) {
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
