'use client';

import { localized, isDefaultLocale, translate } from '@/lib/i18n';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { api, ApiError } from '@/shared/services/api';
import { useTranslations } from '@/components/shared/locale-provider';
import type { EducationalLanguage } from '@/features/languages';

type Question = { id: string; prompt: { fa?: string; en?: string }; type: string; points: number; order: number };
type Section = {
  id: string;
  skill: string;
  title: string;
  durationMinutes: number;
  order: number;
  questions: Question[];
};
type Test = { id: string; slug: string; titleFa: string; titleEn: string; published: boolean; sections: Section[] };
const input =
  'w-full rounded-xl border border-[#dce1ee] bg-white px-3.5 py-3 outline-none transition focus:border-purple focus:ring-4 focus:ring-violet/10';
const value = (form: FormData, key: string) => String(form.get(key) ?? '').trim();

export function AdminTestManager() {
  const { locale } = useTranslations(),
    fa = isDefaultLocale(locale),
    qc = useQueryClient(),
    [selected, setSelected] = useState<string>(),
    [expanded, setExpanded] = useState<string>();
  const query = useQuery({ queryKey: ['admin-tests'], queryFn: () => api<Test[]>('/admin/tests') }),
    // The API refuses a test without an educational language (sections and
    // scoring are language-scoped), so the builder has to offer the choice.
    languages = useQuery({ queryKey: ['languages'], queryFn: () => api<EducationalLanguage[]>('/languages') }),
    languageOptions = languages.data ?? [],
    tests = query.data ?? [],
    active = useMemo(() => tests.find((test) => test.id === (selected ?? tests[0]?.id)), [tests, selected]);
  const mutation = useMutation({
    mutationFn: (task: () => Promise<unknown>) => task(),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['admin-tests'] });
    },
  });
  const message = mutation.error ? (
    <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">
      {mutation.error instanceof ApiError
        ? mutation.error.message
        : translate(locale, 'commercepricingManagerTheOperationFailed')}
    </p>
  ) : mutation.isSuccess ? (
    <p role="status" className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">
      {translate(locale, 'adminadminTestManagerChangesSaved')}
    </p>
  ) : null;
  return (
    <section>
      <header className="mb-7">
        <p className="text-sm font-bold text-purple">{translate(locale, 'adminadminTestManagerSimpleTestBuilder')}</p>
        <h1 className="mt-2 text-3xl font-black">{translate(locale, 'adminadminTestManagerTestsQuestions')}</h1>
        <p className="mt-2 text-sm text-muted">
          {translate(locale, 'adminadminTestManagerCreateATestOpenASkillAndAdd')}
        </p>
      </header>
      <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
        <aside className="space-y-5">
          <form
            className="panel-card p-5"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              mutation.mutate(() =>
                api('/admin/tests/simple', {
                  method: 'POST',
                  body: JSON.stringify({
                    languageId: value(form, 'languageId'),
                    titleFa: value(form, 'titleFa'),
                    titleEn: value(form, 'titleEn'),
                    durationMinutes: Number(value(form, 'durationMinutes')) || 164,
                  }),
                }),
              );
            }}
          >
            <h2 className="flex items-center gap-2 font-black">
              <Plus size={18} />
              {translate(locale, 'adminadminTestManagerNewTest')}
            </h2>
            <p className="mt-2 text-xs leading-6 text-muted">
              {translate(locale, 'adminadminTestManagerEnterTheTitlesAndTheStructureWillBe')}
            </p>
            <div className="mt-4 grid gap-3">
              <div>
                <select
                  className={input}
                  name="languageId"
                  defaultValue=""
                  aria-label={translate(locale, 'adminTestLanguage')}
                  aria-describedby={languages.isError ? 'admin-test-language-error' : undefined}
                  disabled={languages.isLoading || languages.isError}
                  required
                >
                  <option value="" disabled>
                    {translate(locale, 'adminTestSelectLanguage')}
                  </option>
                  {languageOptions.map((language) => (
                    <option key={language.id} value={language.id}>
                      {localized({ fa: language.nameFa, en: language.nameEn }, locale)}
                    </option>
                  ))}
                </select>
                {languages.isError && (
                  <p id="admin-test-language-error" className="mt-2 text-xs text-red-600">
                    {translate(locale, 'languagesLoadError')}
                  </p>
                )}
              </div>
              <input
                className={input}
                name="titleFa"
                placeholder="عنوان فارسی"
                aria-label="عنوان فارسی"
                required
              />
              <input
                className={input}
                name="titleEn"
                dir="ltr"
                placeholder="English title"
                aria-label="English title"
                required
              />
              <input
                className={input}
                name="durationMinutes"
                type="number"
                min="1"
                defaultValue="164"
                aria-label={translate(locale, 'adminadminTestManagerDurationInMinutes')}
              />
              <button
                className="brand-gradient rounded-xl py-3 font-black text-white disabled:opacity-60"
                disabled={mutation.isPending || !languageOptions.length}
              >
                {translate(locale, 'adminadminTestManagerCreateTest')}
              </button>
            </div>
            {message}
          </form>
          <div className="panel-card overflow-hidden p-2">
            <p className="px-3 py-3 text-xs font-bold text-muted">
              {translate(locale, 'adminadminTestManagerExistingTests')}
            </p>
            {query.isLoading ? (
              <div className="skeleton h-24 rounded-xl" />
            ) : query.isError ? (
              <div role="alert" className="m-2 rounded-xl bg-red-50 p-4 text-sm text-red-700">
                <p>
                  {query.error instanceof ApiError
                    ? query.error.message
                    : translate(locale, 'panelresourceViewCouldNotLoadData')}
                </p>
                <button type="button" onClick={() => query.refetch()} className="mt-2 font-black underline">
                  {translate(locale, 'testsaudioRecorderTryAgain')}
                </button>
              </div>
            ) : tests.length ? (
              tests.map((test) => (
                <button
                  key={test.id}
                  onClick={() => setSelected(test.id)}
                  className={`mb-1 w-full rounded-xl p-3 text-start ${active?.id === test.id ? 'bg-lavender text-purple' : 'hover:bg-[#f6f7fb]'}`}
                >
                  <strong className="block text-sm">{localized({ fa: test.titleFa, en: test.titleEn }, locale)}</strong>
                  <small className="mt-1 flex items-center justify-between text-muted">
                    <span>
                      {test.sections.reduce((sum, section) => sum + section.questions.length, 0)}{' '}
                      {translate(locale, 'adminadminTestManagerQuestions')}
                    </span>
                    <span className={test.published ? 'text-emerald-600' : 'text-orange-500'}>
                      {test.published
                        ? translate(locale, 'adminadminTestManagerPublished')
                        : translate(locale, 'adminadminTestManagerDraft')}
                    </span>
                  </small>
                </button>
              ))
            ) : (
              <p className="p-5 text-center text-sm text-muted">
                {translate(locale, 'adminadminTestManagerNoTestsYet')}
              </p>
            )}
          </div>
        </aside>
        <main>
          {active ? (
            <div className="space-y-5">
              <article className="panel-card p-5 md:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-black">
                      {localized({ fa: active.titleFa, en: active.titleEn }, locale)}
                    </h2>
                    <p className="latin mt-1 text-sm text-muted">/{active.slug}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        mutation.mutate(() =>
                          api(`/admin/tests/${active.id}`, {
                            method: 'PATCH',
                            body: JSON.stringify({ published: !active.published }),
                          }),
                        )
                      }
                      className={`rounded-xl px-4 py-2.5 text-sm font-black ${active.published ? 'bg-orange-50 text-orange-600' : 'bg-emerald-50 text-emerald-700'}`}
                    >
                      {active.published
                        ? translate(locale, 'adminadminTestManagerUnpublish')
                        : translate(locale, 'adminadminTestManagerPublish')}
                    </button>
                    <button
                      aria-label={translate(locale, 'adminadminTestManagerDeleteTest')}
                      onClick={() =>
                        confirm(translate(locale, 'adminadminTestManagerDeleteThisTest')) &&
                        mutation.mutate(() => api(`/admin/tests/${active.id}`, { method: 'DELETE' }))
                      }
                      className="grid size-10 place-items-center rounded-xl bg-red-50 text-red-600"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
                {message}
              </article>
              {active.sections.map((section) => (
                <SectionCard
                  key={section.id}
                  section={section}
                  open={expanded === section.id}
                  toggle={() => setExpanded(expanded === section.id ? undefined : section.id)}
                  mutate={(task) => mutation.mutate(task)}
                  fa={fa}
                />
              ))}
            </div>
          ) : (
            <div className="panel-card grid min-h-80 place-items-center p-8 text-center">
              <div>
                <BookOpen className="mx-auto text-purple" size={42} />
                <p className="mt-4 text-muted">{translate(locale, 'adminadminTestManagerCreateOrSelectATest')}</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </section>
  );
}

function SectionCard({
  section,
  open,
  toggle,
  mutate,
  fa,
}: {
  section: Section;
  open: boolean;
  toggle: () => void;
  mutate: (task: () => Promise<unknown>) => void;
  fa: boolean;
}) {
  const { locale } = useTranslations();
  return (
    <article className="panel-card overflow-hidden">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center gap-4 p-5 text-start"
      >
        <span className="brand-gradient grid size-11 place-items-center rounded-xl font-black text-white">
          {section.order}
        </span>
        <span className="flex-1">
          <strong className="block">{section.title}</strong>
          <small className="latin text-muted">
            {section.skill} · {section.questions.length} questions · {section.durationMinutes} min
          </small>
        </span>
        {open ? <ChevronUp /> : <ChevronDown />}
      </button>
      {open && (
        <div className="border-t hairline p-5">
          <QuestionCreator section={section} mutate={mutate} fa={fa} />
          <div className="mt-5 overflow-x-auto rounded-xl border hairline">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="bg-[#f7f8fc] text-muted">
                <tr>
                  <th className="p-3 text-start">#</th>
                  <th className="p-3 text-start">{translate(fa, 'adminadminTestManagerEnglishQuestion')}</th>
                  <th className="p-3 text-start">{translate(fa, 'adminadminTestManagerType')}</th>
                  <th className="p-3 text-start">{translate(fa, 'adminadminTestManagerPoints')}</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody className="divide-y hairline">
                {section.questions.map((question) => (
                  <tr key={question.id}>
                    <td className="p-3 latin">{question.order}</td>
                    <td className="p-3">
                      <strong className="block">
                        {localized({ fa: question.prompt.fa, en: question.prompt.en }, locale)}
                      </strong>
                      <small dir={translate(locale, 'adminadminTestManagerRtl')} className="mt-1 block text-muted">
                        {localized({ fa: question.prompt.en, en: question.prompt.fa }, locale)}
                      </small>
                    </td>
                    <td className="p-3 latin">{question.type}</td>
                    <td className="p-3 latin">{question.points}</td>
                    <td className="p-3 text-end">
                      <button
                        aria-label={translate(locale, 'adminadminTestManagerDeleteQuestion')}
                        onClick={() =>
                          confirm(translate(locale, 'adminadminTestManagerDeleteQuestion2')) &&
                          mutate(() => api(`/admin/tests/questions/${question.id}`, { method: 'DELETE' }))
                        }
                        className="text-red-500"
                      >
                        <Trash2 size={17} />
                      </button>
                    </td>
                  </tr>
                ))}
                {!section.questions.length && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-muted">
                      {translate(fa, 'adminadminTestManagerNoQuestionsYet')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </article>
  );
}

function QuestionCreator({
  section,
  mutate,
  fa,
}: {
  section: Section;
  mutate: (task: () => Promise<unknown>) => void;
  fa: boolean;
}) {
  const [type, setType] = useState('single_choice'),
    objective = ['single_choice', 'multiple_choice'].includes(type),
    withAnswer = objective || type === 'true_false';
  return (
    <form
      className="rounded-2xl bg-[#f8f9fd] p-4 md:p-5"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget),
          lines = (key: string) =>
            value(form, key)
              .split(/\r?\n/)
              .map((item) => item.trim())
              .filter(Boolean),
          choices = objective ? { fa: lines('choicesFa'), en: lines('choicesEn') } : undefined,
          raw = value(form, 'answerKey'),
          answerKey =
            type === 'multiple_choice'
              ? raw
                  .split(',')
                  .map((item) => Number(item.trim()) - 1)
                  .filter(Number.isInteger)
              : withAnswer
                ? Number(raw) - 1
                : undefined;
        mutate(() =>
          api(`/admin/tests/sections/${section.id}/questions`, {
            method: 'POST',
            body: JSON.stringify({
              prompt: { fa: value(form, 'promptFa'), en: value(form, 'promptEn') },
              type,
              choices,
              answerKey,
              points: 1,
              order: section.questions.length + 1,
            }),
          }),
        );
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 className="font-black">{translate(fa, 'adminadminTestManagerAddANewQuestion')}</h4>
          <p className="mt-1 text-xs text-muted">
            {translate(fa, 'adminadminTestManagerQuestionsAreAddedOneAtATimeAnd')}
          </p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs text-purple">{section.questions.length + 1}</span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label>
          <span className="mb-2 block text-xs font-bold">{translate(fa, 'adminadminTestManagerQuestionType')}</span>
          <select value={type} onChange={(event) => setType(event.target.value)} className={input}>
            <option value="single_choice">{translate(fa, 'adminadminTestManagerSingleChoice')}</option>
            <option value="multiple_choice">{translate(fa, 'adminadminTestManagerMultipleChoice')}</option>
            <option value="true_false">{translate(fa, 'adminadminTestManagerTrueFalse')}</option>
            <option value="short_text">{translate(fa, 'adminadminTestManagerShortAnswer')}</option>
            <option value="essay">{translate(fa, 'adminadminTestManagerEssay')}</option>
            <option value="recording">{translate(fa, 'adminadminTestManagerVoiceAnswer')}</option>
          </select>
        </label>
        <div />
        <TextArea name="promptFa" label={translate(fa, 'adminadminTestManagerPersianQuestion')} required />
        <TextArea name="promptEn" label={translate(fa, 'adminadminTestManagerEnglishQuestion2')} dir="ltr" required />
        {objective && (
          <>
            <TextArea
              name="choicesFa"
              label={translate(fa, 'adminadminTestManagerPersianChoicesOnePerLine')}
              required
            />
            <TextArea
              name="choicesEn"
              label={translate(fa, 'adminadminTestManagerEnglishChoicesOnePerLine')}
              dir="ltr"
              required
            />
          </>
        )}
        {withAnswer && (
          <label className="md:col-span-2">
            <span className="mb-2 block text-xs font-bold">
              {type === 'multiple_choice'
                ? translate(fa, 'adminadminTestManagerCorrectOptionNumbersEG13')
                : translate(fa, 'adminadminTestManagerCorrectOptionNumber')}
            </span>
            {type === 'true_false' ? (
              <select name="answerKey" className={input} required>
                <option value="1">{translate(fa, 'adminadminTestManagerTrue')}</option>
                <option value="2">{translate(fa, 'adminadminTestManagerFalse')}</option>
              </select>
            ) : (
              <input
                name="answerKey"
                dir="ltr"
                className={input}
                placeholder={type === 'multiple_choice' ? '1,3' : '1'}
                required
              />
            )}
          </label>
        )}
        <button className="brand-gradient rounded-xl py-3 font-black text-white md:col-span-2">
          <Plus className="inline" size={17} /> {translate(fa, 'adminadminTestManagerAddThisQuestion')}
        </button>
      </div>
    </form>
  );
}

function TextArea({ name, label, dir, required }: { name: string; label: string; dir?: 'ltr'; required?: boolean }) {
  return (
    <label>
      <span className="mb-2 block text-xs font-bold">{label}</span>
      <textarea name={name} dir={dir} className={`${input} min-h-28`} required={required} />
    </label>
  );
}
