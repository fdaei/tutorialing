'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Check,
  CircleHelp,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileCheck2,
  ListChecks,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Target,
  TimerReset,
  Volume2,
} from 'lucide-react';
import { Footer, Header } from '@/components/layout/site';
import { CourseCard } from '@/components/marketplace/cards';
import { api, publicApi } from '@/shared/services/api';
import type { EducationalLanguage } from '@/features/languages';
import { ACCESS_TOKEN_KEY } from '@/shared/services/api';
import { courses } from '@/lib/marketplace-data';
import { useTranslations } from '@/components/shared/locale-provider';
import { isDefaultLocale, localePath, localized } from '@/lib/i18n';
import { placementRecommendationPaths } from './placement-recommendations';

type PlacementTest = {
  id: string;
  titleFa: string;
  titleEn: string;
  descriptionFa: string;
  descriptionEn: string;
  durationMinutes: number;
  language: { id: string; nameFa: string; nameEn: string; nativeName: string; flag: string };
};
type Question = {
  id: string;
  prompt: { fa?: string; en?: string };
  choices: { fa?: unknown[]; en?: unknown[] };
  points: number;
  audioUrl?: string;
};
type TestPayload = { id: string; titleFa: string; titleEn: string; durationMinutes: number; questions: Question[] };
type Result = {
  id: string;
  score: number;
  level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  correctAnswers: number;
  totalQuestions: number;
  completedAt: string;
  titleFa: string;
  titleEn: string;
  description: string;
  strengths: string[];
  focus: string[];
  authenticated: boolean;
  borderline?: boolean;
};

export default function Placement() {
  const { locale } = useTranslations(),
    fa = isDefaultLocale(locale),
    copy = (faCopy: string, enCopy: string) => localized({ fa: faCopy, en: enCopy }, locale),
    numberLocale = fa ? 'fa-IR' : 'en-US';
  const [languageId, setLanguageId] = useState(''),
    [test, setTest] = useState<TestPayload>(),
    [index, setIndex] = useState(0),
    [answers, setAnswers] = useState<Record<string, unknown>>({}),
    [result, setResult] = useState<Result>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [secondsLeft, setSecondsLeft] = useState(0);
  const languages = useQuery({
    queryKey: ['educational-languages'],
    queryFn: () => publicApi<EducationalLanguage[]>('/languages'),
  });
  const tests = useQuery({
    queryKey: ['instant-placement-tests', languageId],
    queryFn: () => publicApi<PlacementTest[]>(`/placement/tests?languageId=${encodeURIComponent(languageId)}`),
    enabled: !!languageId,
  });
  const question = test?.questions[index],
    answered = question ? Object.hasOwn(answers, question.id) : false,
    choices = question
      ? ((localized({ fa: question.choices?.fa, en: question.choices?.en }, locale) ?? []) as unknown[])
      : [],
    selectedLanguage = languages.data?.find((language) => language.id === languageId);

  useEffect(() => {
    if (!test || result) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((current) => Math.max(current - 1, 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [test, result]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!question || event.altKey || event.ctrlKey || event.metaKey || event.target instanceof HTMLInputElement) return;
      const choiceIndex = 'ABCD'.indexOf(event.key.toUpperCase());
      if (choiceIndex >= 0 && choiceIndex < choices.length) {
        setAnswers((current) => ({ ...current, [question.id]: choiceIndex }));
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [choices.length, question]);

  async function start(testId: string) {
    setBusy(true);
    setError('');
    try {
      const payload = await publicApi<TestPayload>(`/placement/questions?testId=${encodeURIComponent(testId)}`);
      let draft: { answers?: Record<string, unknown>; index?: number; secondsLeft?: number } | undefined;
      try {
        const savedDraft = sessionStorage.getItem(draftKey(testId));
        draft = savedDraft ? (JSON.parse(savedDraft) as { answers?: Record<string, unknown>; index?: number; secondsLeft?: number }) : undefined;
      } catch {
        sessionStorage.removeItem(draftKey(testId));
      }
      setTest(payload);
      setIndex(Math.min(Math.max(draft?.index ?? 0, 0), payload.questions.length - 1));
      setAnswers(draft?.answers ?? {});
      setSecondsLeft(draft?.secondsLeft ?? payload.durationMinutes * 60);
      setResult(undefined);
    } catch {
      setError(copy('دریافت سؤال‌ها ممکن نشد. دوباره تلاش کنید.', 'Could not load the questions. Try again.'));
    } finally {
      setBusy(false);
    }
  }
  function draftKey(testId: string) {
    return `lingospeak-placement-draft:${testId}`;
  }
  function saveAndExit() {
    if (!test) return;
    sessionStorage.setItem(
      draftKey(test.id),
      JSON.stringify({ answers, index, secondsLeft }),
    );
    leaveTest();
  }
  function leaveTest() {
    setTest(undefined);
    setAnswers({});
    setIndex(0);
    setSecondsLeft(0);
    setError('');
  }
  async function next() {
    if (!test || !question || !answered) return;
    if (index < test.questions.length - 1) {
      setIndex((i) => i + 1);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const body = {
        testId: test.id,
        answers: test.questions.map((q) => ({ questionId: q.id, value: answers[q.id] })),
      };
      const loggedIn = Boolean(sessionStorage.getItem(ACCESS_TOKEN_KEY));
      const outcome = loggedIn
        ? await api<Result>('/placement/submit', { method: 'POST', body: JSON.stringify(body) })
        : await publicApi<Result>('/placement/guest/submit', { method: 'POST', body: JSON.stringify(body) });
      setResult(outcome);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setError(
        copy(
          'محاسبه نتیجه انجام نشد. پاسخ‌ها حفظ شده‌اند؛ دوباره تلاش کنید.',
          'Could not calculate your result. Your answers are preserved; try again.',
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  function restart() {
    if (test) sessionStorage.removeItem(draftKey(test.id));
    setTest(undefined);
    setResult(undefined);
    setAnswers({});
    setIndex(0);
    setSecondsLeft(0);
    setError('');
  }
  if (result) {
    const selectedLanguage = languages.data?.find((language) => language.id === languageId);
    return (
      <ResultView
        result={result}
        onRestart={restart}
        locale={locale}
        languageCode={selectedLanguage?.code ?? ''}
        languageName={selectedLanguage?.nameFa ?? ''}
      />
    );
  }
  if (test && question) {
    const progress = Math.round(((index + 1) / test.questions.length) * 100);
    const remainingQuestions = Math.max(test.questions.length - index - 1, 0);
    return (
      <>
        <Header />
        <main className="placement-test-page">
          <div className="placement-test-shell">
            <div className="placement-test-toolbar">
              <div className="placement-toolbar-status">
                <details className="placement-rules">
                  <summary className="placement-rules-button">
                    <ShieldCheck size={17} />
                    {copy('قوانین آزمون', 'Test rules')}
                  </summary>
                  <p>{copy('برای هر سوال یک پاسخ را انتخاب کنید. می‌توانید پاسخ‌ها را مرور کنید و در پایان نتیجه را ببینید.', 'Choose one answer per question. You can review your answers before viewing your result.')}</p>
                </details>
                <span className="placement-remaining">
                  <ListChecks size={17} />
                  <span>
                    <small>{copy('باقی‌مانده', 'Remaining')}</small>
                    <strong>{remainingQuestions.toLocaleString(numberLocale)}</strong>
                  </span>
                </span>
                <TimerBadge seconds={secondsLeft} fa={fa} />
              </div>
              <button type="button" onClick={saveAndExit} className="placement-toolbar-button">
                <Save size={17} />
                {copy('ذخیره و خروج', 'Save & exit')}
              </button>
            </div>

            <section className="placement-test-header">
              <div className="placement-test-heading">
                <div className="placement-test-eyebrow">
                  <span className="placement-live-dot" />
                  {copy('ارزیابی آنلاین LingoSpeak', 'LingoSpeak online assessment')}
                </div>
                <h1>{copy('آزمون تعیین سطح زبان', 'Language placement test')}</h1>
                <p>{copy('سطح فعلی زبان شما را در کمتر از ۱۰ دقیقه ارزیابی کنید.', 'Assess your current language level in less than 10 minutes.')}</p>
              </div>
              <div className="placement-test-facts">
                <div className="placement-test-language">
                  <span className="placement-language-flag">{selectedLanguage?.flag || '🌐'}</span>
                  <span>
                    <small>{copy('زبان آزمون', 'Test language')}</small>
                    <strong>{selectedLanguage ? localized({ fa: selectedLanguage.nameFa, en: selectedLanguage.nameEn }, locale) : test.titleEn}</strong>
                  </span>
                </div>
                <div className="placement-fact">
                  <FileCheck2 size={19} />
                  <span>
                    <small>{copy('تعداد سوال', 'Questions')}</small>
                    <strong>{test.questions.length.toLocaleString(numberLocale)} {copy('سوال', 'questions')}</strong>
                  </span>
                </div>
                <div className="placement-fact">
                  <Clock3 size={19} />
                  <span>
                    <small>{copy('زمان تقریبی', 'Duration')}</small>
                    <strong>{test.durationMinutes.toLocaleString(numberLocale)} {copy('دقیقه', 'minutes')}</strong>
                  </span>
                </div>
              </div>
            </section>

            <ProgressSection
              current={index + 1}
              total={test.questions.length}
              progress={progress}
              locale={locale}
              numberLocale={numberLocale}
            />

            <section className="placement-question-card">
              <div className="placement-question-card-top">
                <div>
                  <span className="placement-question-number latin">
                    Question {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="placement-question-type">
                    <BadgeCheck size={15} />
                    {copy('یک پاسخ را انتخاب کنید', 'Choose one answer')}
                  </span>
                </div>
                {question.audioUrl && (
                  <button type="button" className="placement-audio-button">
                    <Volume2 size={17} />
                    {copy('شنیدن سوال', 'Listen')}
                  </button>
                )}
              </div>
              <div className="placement-prompt-wrap">
                <span className="placement-prompt-kicker">{copy('بهترین گزینه را انتخاب کنید', 'Select the best option')}</span>
                <h2
                  className="placement-prompt latin"
                  dir={selectedLanguage?.direction === 'RTL' ? 'rtl' : 'ltr'}
                  lang={selectedLanguage?.code}
                >
                  <QuestionPrompt text={String(localized({ fa: question.prompt.fa, en: question.prompt.en }, locale) ?? '')} />
                </h2>
              </div>
              <div className="placement-options" role="radiogroup" aria-label={copy('گزینه‌های پاسخ', 'Answer options')}>
                {choices.map((choice, choiceIndex) => {
                  const selected = answers[question.id] === choiceIndex;
                  return (
                    <button
                      key={choiceIndex}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      aria-keyshortcuts={String.fromCharCode(65 + choiceIndex)}
                      onClick={() => setAnswers((current) => ({ ...current, [question.id]: choiceIndex }))}
                      className={`placement-option ${selected ? 'is-selected' : ''}`}
                    >
                      <span className="placement-option-key latin">{String.fromCharCode(65 + choiceIndex)}</span>
                      <span className="placement-option-copy">{String(choice)}</span>
                      <span className="placement-option-check">{selected ? <Check size={17} /> : null}</span>
                    </button>
                  );
                })}
              </div>
              {error && (
                <p role="alert" className="placement-error">
                  {error}
                </p>
              )}
              <div className="placement-navigation">
                <button
                  type="button"
                  disabled={index === 0 || busy}
                  onClick={() => setIndex((i) => i - 1)}
                  className="placement-secondary-action"
                >
                  {fa ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                  {copy('سوال قبلی', 'Previous question')}
                </button>
                <span className="placement-keyboard-hint">
                  <CircleHelp size={15} />
                  {copy('برای انتخاب سریع از کلیدهای A تا D استفاده کنید', 'Use A to D for quick selection')}
                </span>
                <button
                  type="button"
                  disabled={!answered || busy}
                  onClick={next}
                  className="placement-primary-action"
                >
                  {busy
                    ? copy('در حال محاسبه سطح شما...', 'Calculating your level…')
                    : index === test.questions.length - 1
                      ? copy('مشاهده نتیجه', 'View result')
                      : copy('ثبت پاسخ و ادامه', 'Save & continue')}
                  {fa ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
                </button>
              </div>
            </section>
          </div>
        </main>
      </>
    );
  }
  return (
    <>
      <Header />
      <main>
        <section className="placement-entry">
          <div className="page-shell placement-entry-grid">
            <div className="placement-entry-copy">
              <span className="placement-entry-kicker">
                <Sparkles size={16} />
                {copy('ارزیابی استاندارد بر اساس CEFR', 'CEFR-aligned assessment')}
              </span>
              <h1>{copy('آزمون تعیین سطح زبان', 'Language placement test')}</h1>
              <p>{copy('سطح فعلی زبان شما را در کمتر از ۱۰ دقیقه ارزیابی کنید.', 'Assess your current language level in less than 10 minutes.')}</p>
              <div className="placement-entry-trust">
                <span><ShieldCheck size={17} />{copy('نتیجه فوری و خودکار', 'Instant automated result')}</span>
                <span><BadgeCheck size={17} />{copy('بدون نیاز به ثبت‌نام', 'No sign-up required')}</span>
              </div>
              <div className="placement-entry-skills">
                <small>{copy('مهارت‌های ارزیابی‌شده', 'Skills assessed')}</small>
                <span><BookOpen size={15} />{copy('واژگان', 'Vocabulary')}</span>
                <span><BadgeCheck size={15} />{copy('گرامر', 'Grammar')}</span>
                <span><Target size={15} />{copy('درک مطلب', 'Reading')}</span>
              </div>
            </div>
            <div className="placement-entry-preview" aria-hidden="true">
              <div className="placement-preview-label">{copy('مسیر سنجش شما', 'Your assessment route')}</div>
              <div className="placement-preview-levels">
                {['A1', 'A2', 'B1', 'B2', 'C1'].map((level, levelIndex) => (
                  <span key={level} className={levelIndex === 2 ? 'is-active' : ''}>
                    <i />
                    <strong className="latin">{level}</strong>
                  </span>
                ))}
              </div>
              <div className="placement-preview-time">
                <TimerReset size={20} />
                <span><strong className="latin">10:00</strong><small>{copy('زمان پیشنهادی', 'Suggested time')}</small></span>
              </div>
            </div>
          </div>
        </section>
        <section className="page-shell placement-entry-content">
          <div className="placement-section-heading">
            <div>
              <span className="placement-section-kicker">{copy('شروع ارزیابی', 'Start assessment')}</span>
              <h2>{copy('زبان موردنظر خود را انتخاب کنید', 'Choose your test language')}</h2>
              <p>{copy('آزمون متناسب با زبان انتخابی شما، از سطح A1 تا C1 طراحی شده است.', 'Your test is tailored to the language you choose and spans A1 to C1.')}</p>
            </div>
            <div className="placement-secure-note"><ShieldCheck size={17} />{copy('پاسخ‌ها محرمانه می‌مانند', 'Your answers stay private')}</div>
          </div>
          {languages.isLoading ? (
            <div className="placement-language-grid">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="skeleton placement-language-skeleton" />
              ))}
            </div>
          ) : languages.isError ? (
            <Error
              text={copy('فهرست زبان‌ها دریافت نشد.', 'Could not load the language list.')}
              retryLabel={copy('تلاش دوباره', 'Try again')}
              onRetry={() => void languages.refetch()}
            />
          ) : (
            <div className="placement-language-grid">
              {languages.data?.map((language) => (
                <button
                  key={language.id}
                  onClick={() => {
                    setLanguageId(language.id);
                    setError('');
                  }}
                  className={`placement-language-card ${languageId === language.id ? 'is-selected' : ''}`}
                >
                  <span className="placement-language-card-top">
                    <span className="placement-language-flag">{language.flag || '🌐'}</span>
                    {languageId === language.id && <Check size={17} />}
                  </span>
                  <strong>{localized({ fa: language.nameFa, en: language.nameEn }, locale)}</strong>
                  <small>{language.nativeName}</small>
                </button>
              ))}
            </div>
          )}
          <div className="mt-8">
            {!languageId ? (
              <div className="rounded-2xl border border-dashed hairline p-8 text-center text-muted">
                {copy('ابتدا زبان موردنظر را انتخاب کنید.', 'Select a language to see available tests.')}
              </div>
            ) : tests.isLoading ? (
              <div className="skeleton h-48 rounded-3xl" />
            ) : tests.isError ? (
              <Error
                text={copy('آزمون‌ها دریافت نشدند.', 'Could not load the tests.')}
                retryLabel={copy('تلاش دوباره', 'Try again')}
                onRetry={() => void tests.refetch()}
              />
            ) : tests.data?.length ? (
              <div className="placement-test-list">
                {tests.data.map((item) => (
                  <article className="placement-test-card" key={item.id}>
                    <div className="placement-test-card-heading">
                      <span className="placement-test-card-language">{item.language.flag || '🌐'}</span>
                      <span className="placement-test-card-badge">{copy('آزمون آماده است', 'Ready to take')}</span>
                    </div>
                    <h3>{localized({ fa: item.titleFa, en: item.titleEn }, locale)}</h3>
                    <p>{localized({ fa: item.descriptionFa, en: item.descriptionEn }, locale)}</p>
                    <div className="placement-test-card-facts">
                      <span><Clock3 size={16} />{item.durationMinutes.toLocaleString(numberLocale)} {copy('دقیقه', 'min')}</span>
                      <span><FileCheck2 size={16} />{copy('۳۰ سوال', '30 questions')}</span>
                      <span><BookOpen size={16} />{copy('CEFR', 'CEFR')}</span>
                    </div>
                    <button
                      disabled={busy}
                      onClick={() => start(item.id)}
                      className="placement-start-button"
                    >
                      {copy('شروع آزمون', 'Start test')} {fa ? <ArrowLeft size={18} /> : <ArrowRight size={18} />}
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed hairline p-8 text-center text-muted">
                {copy(
                  'برای این زبان هنوز آزمون کاملاً خودکار منتشر نشده است.',
                  'No fully automated test has been published for this language yet.',
                )}
              </div>
            )}
          </div>
          {error && <Error text={error} />}
        </section>
      </main>
      <Footer />
    </>
  );
}

function ProgressSection({
  current,
  total,
  progress,
  locale,
  numberLocale,
}: {
  current: number;
  total: number;
  progress: number;
  locale: 'fa' | 'en';
  numberLocale: string;
}) {
  const fa = locale === 'fa';
  const milestones = [
    { label: fa ? 'شروع' : 'Start', threshold: 0 },
    { label: fa ? 'میانی' : 'Intermediate', threshold: 50 },
    { label: fa ? 'تکمیل' : 'Complete', threshold: 100 },
  ];
  return (
    <section className="placement-progress-card" aria-label={fa ? 'پیشرفت آزمون' : 'Test progress'}>
      <div className="placement-progress-heading">
        <div>
          <small>{fa ? 'پیشرفت آزمون' : 'Assessment progress'}</small>
          <strong>
            {fa ? 'سوال' : 'Question'} {current.toLocaleString(numberLocale)} {fa ? 'از' : 'of'} {total.toLocaleString(numberLocale)}
          </strong>
        </div>
        <strong className="placement-progress-percent latin">{progress}% <small>{fa ? 'تکمیل شده' : 'complete'}</small></strong>
      </div>
      <div className="placement-progress-track" dir="ltr">
        <span style={{ width: `${progress}%` }} />
      </div>
      <div className="placement-milestones">
        {milestones.map((milestone) => (
          <div key={milestone.label} className={progress >= milestone.threshold ? 'is-active' : ''}>
            <span />
            <small>{milestone.label}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

function TimerBadge({ seconds, fa }: { seconds: number; fa: boolean }) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const remainingSeconds = (seconds % 60).toString().padStart(2, '0');
  const urgent = seconds > 0 && seconds <= 60;
  return (
    <div className={`placement-timer ${urgent ? 'is-urgent' : ''}`} role="status" aria-live="polite">
      <TimerReset size={18} />
      <span>
        <small>{fa ? 'زمان باقی‌مانده' : 'Time remaining'}</small>
        <strong className="latin">{minutes}:{remainingSeconds}</strong>
      </span>
    </div>
  );
}

function QuestionPrompt({ text }: { text: string }) {
  const parts = text.split('___');
  return (
    <>
      {parts.map((part, index) => (
        <span key={`${part}-${index}`}>
          {part}
          {index < parts.length - 1 && <span className="placement-blank" aria-label="blank" />}
        </span>
      ))}
    </>
  );
}

function ResultView({
  result,
  onRestart,
  locale,
  languageCode,
  languageName,
}: {
  result: Result;
  onRestart: () => void;
  locale: 'fa' | 'en';
  languageCode: string;
  languageName: string;
}) {
  const fa = isDefaultLocale(locale),
    copy = (faCopy: string, enCopy: string) => localized({ fa: faCopy, en: enCopy }, locale),
    numberLocale = fa ? 'fa-IR' : 'en-US',
    recommendations = placementRecommendationPaths(languageCode, result.level, locale);
  const suggested = courses
    .filter(
      (course) =>
        (!languageName || course.language === languageName) &&
        (course.level === result.level ||
          course.level === ({ A1: 'A2', A2: 'B1', B1: 'B2', B2: 'B2', C1: 'B2', C2: 'B2' } as const)[result.level]),
    )
    .slice(0, 3);
  return (
    <>
      <Header />
      <main className="bg-canvas">
        <section className="result-hero">
          <div className="page-shell py-14 text-center text-white md:py-20">
            <p className="text-sm font-black text-emerald-200">{copy('نتیجه شما آماده است', 'Your result is ready')}</p>
            <div className="mx-auto mt-6 grid size-36 place-items-center rounded-full border-8 border-white/15 bg-white/10 shadow-2xl">
              <span>
                <strong className="latin block text-5xl">{result.level}</strong>
                <small>{localized({ fa: result.titleFa, en: result.titleEn }, locale)}</small>
              </span>
            </div>
            <h1 className="mt-6 text-3xl font-black md:text-5xl">
              {copy('سطح زبان شما:', 'Your language level:')}{' '}
              <span className="latin">
                {result.level} · {result.titleEn}
              </span>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl leading-8 text-white/70">{result.description}</p>
            {result.borderline && (
              <p className="mx-auto mt-5 max-w-2xl rounded-xl border border-amber-200/25 bg-amber-100/10 px-4 py-3 text-sm font-bold text-amber-100">
                {copy(
                  'نتیجه بین دو سطح قرار دارد؛ برای تعیین دقیق‌تر، ارزیابی تکمیلی پیشنهاد می‌شود.',
                  'Your result is borderline; a further assessment is recommended for a more precise level.',
                )}
              </p>
            )}
          </div>
        </section>
        <div className="page-shell grid gap-7 py-12 lg:grid-cols-[1fr_340px]">
          <div className="grid gap-7">
            <section className="surface-card p-6 md:p-8">
              <div className="grid gap-4 sm:grid-cols-3">
                <Stat
                  label={copy('امتیاز نهایی', 'Final score')}
                  value={`${result.score.toLocaleString(numberLocale)}%`}
                />
                <Stat
                  label={copy('پاسخ درست', 'Correct answers')}
                  value={`${result.correctAnswers.toLocaleString(numberLocale)} ${copy('از', 'of')} ${result.totalQuestions.toLocaleString(numberLocale)}`}
                />
                <Stat label={copy('سطح CEFR', 'CEFR level')} value={result.level} />
              </div>
            </section>
            <section className="grid gap-5 md:grid-cols-2">
              <div className="surface-card p-6">
                <h2 className="font-black text-green">{copy('توانایی‌های فعلی', 'Current strengths')}</h2>
                <ul className="mt-4 grid gap-3 text-sm">
                  {result.strengths.map((item) => (
                    <li className="flex gap-2" key={item}>
                      <Check size={17} className="text-green" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="surface-card p-6">
                <h2 className="font-black text-orange">{copy('تمرکز پیشنهادی', 'Recommended focus')}</h2>
                <ul className="mt-4 grid gap-3 text-sm">
                  {result.focus.map((item) => (
                    <li className="flex gap-2" key={item}>
                      <Target size={17} className="text-orange" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          </div>
          <aside className="surface-card p-6">
            <h2 className="text-xl font-black">{copy('قدم بعدی شما', 'Your next step')}</h2>
            <p className="mt-3 text-sm leading-7 text-muted">
              {copy(
                'یک دوره متناسب با سطح فعلی انتخاب کنید و با برنامه منظم پیش بروید.',
                'Choose a course matched to your current level and continue with a consistent plan.',
              )}
            </p>
            <Link
              href={recommendations.courses}
              className="brand-gradient mt-6 flex min-h-12 items-center justify-center rounded-xl font-black text-white"
            >
              {copy('مشاهده دوره‌های پیشنهادی', 'View recommended courses')}
            </Link>
            <Link
              href={recommendations.teachers}
              className="mt-3 flex min-h-12 items-center justify-center rounded-xl border hairline font-bold"
            >
              {copy('مشاهده مدرس‌های مرتبط', 'View related teachers')}
            </Link>
            {result.authenticated ? (
              <Link
                href={localePath('/dashboard', locale)}
                className="mt-3 flex min-h-12 items-center justify-center rounded-xl border hairline font-bold"
              >
                {copy('رفتن به داشبورد', 'Go to dashboard')}
              </Link>
            ) : (
              <Link
                href={`${localePath('/auth', locale)}?next=${encodeURIComponent(localePath('/dashboard/tests', locale))}`}
                className="mt-3 flex min-h-12 items-center justify-center rounded-xl border hairline px-3 text-center font-bold text-purple"
              >
                {copy('ورود و ذخیره پیشنهادهای شخصی', 'Sign in and save personalized recommendations')}
              </Link>
            )}
            <button
              onClick={onRestart}
              className="mt-5 flex w-full items-center justify-center gap-2 text-sm text-muted"
            >
              <RotateCcw size={16} />
              {copy('تکرار آزمون', 'Retake test')}
            </button>
          </aside>
        </div>
        {suggested.length > 0 && (
          <section className="border-t hairline bg-white py-14">
            <div className="page-shell">
              <h2 className="text-2xl font-black">
                {copy(`دوره‌های مناسب سطح ${result.level}`, `Courses for level ${result.level}`)}
              </h2>
              <div className="mt-7 grid gap-5 md:grid-cols-3">
                {suggested.map((course) => (
                  <CourseCard key={course.slug} course={course} />
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-canvas p-5 text-center">
      <strong className="latin block text-3xl text-purple">{value}</strong>
      <span className="mt-2 block text-xs text-muted">{label}</span>
    </div>
  );
}
function Error({ text, retryLabel, onRetry }: { text: string; retryLabel?: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="mt-5 rounded-2xl border border-red-100 bg-red-50 p-5 text-red-700">
      <p>{text}</p>
      {onRetry && retryLabel && (
        <button type="button" onClick={onRetry} className="mt-3 flex items-center gap-2 font-black underline">
          <RotateCcw size={16} />
          {retryLabel}
        </button>
      )}
    </div>
  );
}
