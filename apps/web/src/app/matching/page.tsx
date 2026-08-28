'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { matchingSchema, type MatchingInput } from '@lingospeak/contracts';
import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, BadgeCheck, CalendarDays, Sparkles, Star } from 'lucide-react';
import { Header, Footer } from '@/components/layout/site';
import { api, publicApi, type EducationalLanguage, ApiError, apiMessage } from '@/lib/api';
import { useTranslations } from '@/components/shared/locale-provider';
import { localePath, localized, isDefaultLocale, translate } from '@/lib/i18n';

type Recommendation = {
  rank: number;
  score: number;
  reasons: { fa?: string[]; en?: string[] } | string[];
  teacher: {
    id: string;
    slug: string;
    nameFa: string;
    nameEn: string;
    rating: number;
    reviewsCount: number;
    approvedTrialPrice?: number;
    approvedRegularPrice?: number;
    trialDuration: number;
    lessonDuration: number;
    specialties: string[];
    languageLinks: { language: EducationalLanguage; levels: string[]; specialties: string[] }[];
  };
};
type Result = { id: string; recommendations: Recommendation[] };
const skillOptions = [
  'conversation',
  'grammar',
  'listening',
  'reading',
  'writing',
  'speaking',
  'exam-preparation',
  'business',
];
const levelOptions = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export default function Matching() {
  const { locale } = useTranslations(),
    fa = isDefaultLocale(locale),
    p = (href: string) => localePath(href, locale),
    Arrow = localized({ fa: ArrowLeft, en: ArrowRight }, locale),
    [result, setResult] = useState<Result>();
  const languages = useQuery({
    queryKey: ['educational-languages'],
    queryFn: () => publicApi<EducationalLanguage[]>('/languages'),
  });
  const form = useForm<MatchingInput>({
    resolver: zodResolver(matchingSchema),
    defaultValues: {
      languageId: '',
      currentLevel: 'A1',
      learningGoal: 'conversation',
      targetLevel: 'B2',
      weakSkills: [],
      budget: 350000,
      suitableDays: [],
      preferredTime: 'evening',
      trialRequired: true,
      classType: 'private',
    },
  });
  const mutation = useMutation({
    mutationFn: (data: MatchingInput) =>
      api<Result>('/matching', {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          availability: { suitableDays: data.suitableDays, preferredTime: data.preferredTime },
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      }),
    onSuccess: setResult,
  });
  const money = (value?: number) =>
    value
      ? new Intl.NumberFormat(translate(locale, 'commercepricingManagerEnUS2')).format(value) +
        translate(locale, 'commercepricingManagerIrr')
      : '—';
  return (
    <>
      <Header />
      <main className="mx-auto max-w-6xl px-6 py-16">
        {result ? (
          <div>
            <p className="text-sm font-black text-purple">{translate(locale, 'matchingSavedSmartMatchingResult')}</p>
            <h1 className="mt-4 text-4xl font-black">{translate(locale, 'matchingYourThreeStrongestMatches')}</h1>
            {result.recommendations.length ? (
              <div className="mt-10 grid gap-6 lg:grid-cols-3">
                {result.recommendations.map((item) => {
                  const reasons = Array.isArray(item.reasons)
                    ? item.reasons
                    : (localized({ fa: item.reasons.fa, en: item.reasons.en }, locale) ??
                      item.reasons.fa ??
                      item.reasons.en ??
                      []);
                  return (
                    <article
                      key={item.teacher.id}
                      className="relative rounded-3xl border hairline bg-white p-6 shadow-soft"
                    >
                      <span className="absolute end-5 top-5 rounded-full bg-lavender px-3 py-1 text-xs font-black text-purple">
                        #{item.rank} · {item.score}%
                      </span>
                      <div className="brand-gradient grid size-16 place-items-center rounded-2xl text-2xl font-black text-white">
                        {localized({ fa: item.teacher.nameFa, en: item.teacher.nameEn }, locale).slice(0, 1)}
                      </div>
                      <h2 className="mt-5 flex items-center gap-2 text-xl font-black">
                        {localized({ fa: item.teacher.nameFa, en: item.teacher.nameEn }, locale)}
                        <BadgeCheck size={18} className="text-blue" />
                      </h2>
                      <p className="mt-2 flex items-center gap-2 text-sm">
                        <Star size={15} fill="#f5a623" className="text-[#f5a623]" />
                        {item.teacher.rating} ({item.teacher.reviewsCount})
                      </p>
                      <ul className="mt-5 min-h-40 space-y-3 text-sm leading-6 text-muted">
                        {reasons.map((reason) => (
                          <li key={reason} className="flex gap-2">
                            <Sparkles size={15} className="mt-1 shrink-0 text-purple" />
                            {reason}
                          </li>
                        ))}
                      </ul>
                      <div className="mt-5 border-t hairline pt-5">
                        <p className="text-xs text-muted">{translate(locale, 'matchingTrialPrice')}</p>
                        <strong className="mt-1 block text-blue">{money(item.teacher.approvedTrialPrice)}</strong>
                        <Link
                          href={p(`/teachers/${item.teacher.slug}`)}
                          className="brand-gradient mt-5 block rounded-xl py-3 text-center font-black text-white"
                        >
                          {translate(locale, 'matchingViewProfileAndBook')}
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="mt-10 rounded-3xl border border-dashed hairline p-10 text-center">
                <h2 className="text-xl font-black">{translate(locale, 'matchingNoCompatibleTeacherWasFound')}</h2>
                <p className="mt-3 text-muted">
                  {translate(locale, 'matchingTryExpandingYourBudgetAvailableDaysOrPreferred')}
                </p>
              </div>
            )}
            <button
              onClick={() => setResult(undefined)}
              className="mt-8 rounded-full border hairline px-6 py-3 font-bold"
            >
              {translate(locale, 'matchingEditAnswers')}
            </button>
          </div>
        ) : (
          <div className="grid gap-14 lg:grid-cols-[.78fr_1.22fr]">
            <div>
              <span className="brand-gradient grid h-14 w-14 place-items-center rounded-2xl text-white">
                <Sparkles />
              </span>
              <h1 className="mt-8 text-5xl font-black leading-tight">
                {translate(locale, 'matchingFindATeacherWhoFitsYourLanguageGoal')}
              </h1>
              <p className="mt-5 leading-8 text-muted">
                {translate(locale, 'matchingOnlyVerifiedTeachersWithApprovedPricingAndReal')}
              </p>
            </div>
            <form
              onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
              className="rounded-4xl border hairline bg-white p-7 shadow-soft sm:p-9"
            >
              <Field
                label={translate(locale, 'matchingTargetLanguage')}
                error={form.formState.errors.languageId?.message}
              >
                <select {...form.register('languageId')} className="input">
                  <option value="">{translate(locale, 'matchingSelectLanguage')}</option>
                  {languages.data?.map((language) => (
                    <option key={language.id} value={language.id}>
                      {language.flag} {localized({ fa: language.nameFa, en: language.nameEn }, locale)} —{' '}
                      {language.nativeName}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label={translate(locale, 'matchingCurrentLevel')}>
                  <select {...form.register('currentLevel')} className="input">
                    {levelOptions.map((level) => (
                      <option key={level}>{level}</option>
                    ))}
                  </select>
                </Field>
                <Field label={translate(locale, 'matchingTargetLevel')}>
                  <select {...form.register('targetLevel')} className="input">
                    {levelOptions.map((level) => (
                      <option key={level}>{level}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field
                label={translate(locale, 'matchingLearningGoal')}
                error={form.formState.errors.learningGoal?.message}
              >
                <select {...form.register('learningGoal')} className="input">
                  <option value="conversation">{translate(locale, 'matchingEverydayConversation')}</option>
                  <option value="exam">{translate(locale, 'matchingExamPreparation')}</option>
                  <option value="work">{translate(locale, 'matchingWorkAndMigration')}</option>
                  <option value="academic">{translate(locale, 'matchingAcademicStudy')}</option>
                  <option value="travel">{translate(locale, 'matchingTravel')}</option>
                </select>
              </Field>
              <Field label={translate(locale, 'matchingWeakSkills')} error={form.formState.errors.weakSkills?.message}>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {skillOptions.map((skill) => (
                    <label key={skill} className="rounded-xl border hairline p-3 text-sm">
                      <input
                        className="me-2 accent-purple"
                        type="checkbox"
                        value={skill}
                        {...form.register('weakSkills')}
                      />
                      {translateSkill(skill, fa)}
                    </label>
                  ))}
                </div>
              </Field>
              <Field label={translate(locale, 'matchingBudgetPerLesson')} error={form.formState.errors.budget?.message}>
                <input
                  className="input"
                  type="number"
                  min={10000}
                  step={10000}
                  {...form.register('budget', { valueAsNumber: true })}
                />
              </Field>
              <Field
                label={translate(locale, 'matchingSuitableDays')}
                error={form.formState.errors.suitableDays?.message}
              >
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                  {weekdays(fa).map((day, index) => (
                    <label key={day} className="rounded-xl border hairline p-3 text-center text-sm">
                      <input
                        className="mb-2 block w-full accent-purple"
                        type="checkbox"
                        value={index}
                        {...form.register('suitableDays')}
                      />
                      {day}
                    </label>
                  ))}
                </div>
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label={translate(locale, 'matchingPreferredTime')}>
                  <select {...form.register('preferredTime')} className="input">
                    <option value="morning">{translate(locale, 'matchingMorning')}</option>
                    <option value="afternoon">{translate(locale, 'matchingAfternoon')}</option>
                    <option value="evening">{translate(locale, 'matchingEvening')}</option>
                  </select>
                </Field>
                <Field label={translate(locale, 'matchingPreferredTeacherGenderOptional')}>
                  <select {...form.register('preferredTeacherGender')} className="input">
                    <option value="">{translate(locale, 'matchingNoPreference')}</option>
                    <option value="female">{translate(locale, 'matchingFemale')}</option>
                    <option value="male">{translate(locale, 'matchingMale')}</option>
                  </select>
                </Field>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label={translate(locale, 'matchingClassType')}>
                  <select {...form.register('classType')} className="input">
                    <option value="private">{translate(locale, 'matchingPrivate')}</option>
                    <option value="group">{translate(locale, 'matchingGroup')}</option>
                    <option value="either">{translate(locale, 'matchingEither')}</option>
                  </select>
                </Field>
                <label className="flex items-center gap-3 rounded-2xl border hairline p-4">
                  <input type="checkbox" className="size-5 accent-purple" {...form.register('trialRequired')} />
                  <span>
                    <strong className="block">{translate(locale, 'matchingINeedATrialLesson')}</strong>
                    <small className="text-muted">
                      {translate(locale, 'matchingMatchUsingTrialPricingAndDuration')}
                    </small>
                  </span>
                </label>
              </div>
              {mutation.isError && (
                <div role="alert" className="mb-5 rounded-2xl bg-red-50 p-4 text-red-800">
                  {mutation.error instanceof ApiError && mutation.error.status === 401 ? (
                    <span>
                      {translate(locale, 'matchingSignInFirstToSaveTheResult')}
                      <Link className="underline" href={p(`/auth?next=${p('/matching')}`)}>
                        {translate(locale, 'matchingSignIn')}
                      </Link>
                      .
                    </span>
                  ) : (
                    apiMessage(mutation.error, translate(locale, 'matchingCouldNotCalculateRecommendations'))
                  )}
                </div>
              )}
              <button
                disabled={mutation.isPending || languages.isLoading}
                className="brand-gradient flex w-full justify-center gap-3 rounded-xl py-4 font-black text-white disabled:opacity-50"
              >
                {mutation.isPending
                  ? translate(locale, 'matchingCheckingTeachersAndLiveAvailability')
                  : translate(locale, 'matchingSeeTheTopThreeMatches')}
                <Arrow />
              </button>
            </form>
          </div>
        )}
      </main>
      <Footer />
      <style jsx global>{`
        .input {
          width: 100%;
          border: 1px solid rgba(16, 29, 53, 0.14);
          border-radius: 1rem;
          padding: 1rem;
          background: white;
          outline: none;
        }
        .input:focus {
          border-color: #7257d9;
          box-shadow: 0 0 0 4px rgba(114, 87, 217, 0.1);
        }
      `}</style>
    </>
  );
}
function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <fieldset className="mb-7">
      <legend className="mb-3 font-black">{label}</legend>
      {children}
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </fieldset>
  );
}
function weekdays(fa: boolean) {
  return localized(
    { fa: ['یک', 'دو', 'سه', 'چهار', 'پنج', 'جمعه', 'شنبه'], en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] },
    fa,
  );
}
function translateSkill(skill: string, fa: boolean) {
  const map: Record<string, string> = {
    conversation: 'مکالمه',
    grammar: 'گرامر',
    listening: 'شنیداری',
    reading: 'خواندن',
    writing: 'نوشتن',
    speaking: 'گفتاری',
    'exam-preparation': 'آزمون',
    business: 'کسب‌وکار',
  };
  return localized({ fa: map[skill] ?? skill, en: skill.replace('-', ' ') }, fa);
}
