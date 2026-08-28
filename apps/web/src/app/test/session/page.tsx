'use client';
import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Flag, WifiOff } from 'lucide-react';
import { api, apiMessage } from '@/shared/services/api';
import { AudioRecorder } from '@/features/tests/components/audio-recorder';
import { useTranslations } from '@/components/shared/locale-provider';
import { localePath, localized, isDefaultLocale, translate } from '@/lib/i18n';
type Answer = {
  value?: unknown;
  textValue?: string;
  fileId?: string;
  flagged: boolean;
  reviewStatus?: 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'NEEDS_REVISION' | null;
  feedbackFa?: string | null;
  feedbackEn?: string | null;
};
type Choices = string[] | { fa?: string[]; en?: string[] };
type Question = { id: string; prompt: { fa?: string; en?: string }; type: string; choices?: Choices; order: number };
type Attempt = {
  id: string;
  expiresAt: string;
  currentSectionId: string;
  status: string;
  answers: ({ questionId: string } & Answer)[];
  test: { sections: { id: string; skill: string; title: string; durationMinutes: number; questions: Question[] }[] };
};
export default function TestSession() {
  const id = useSearchParams().get('attempt') ?? '',
    router = useRouter(),
    qc = useQueryClient(),
    { locale } = useTranslations(),
    fa = isDefaultLocale(locale),
    p = (href: string) => localePath(href, locale),
    attempt = useQuery({
      queryKey: ['attempt', id],
      queryFn: () => api<Attempt>(`/tests/attempts/${id}`),
      enabled: !!id,
    });
  const [answers, setAnswers] = useState<Record<string, Answer>>({}),
    [online, setOnline] = useState(true),
    [remaining, setRemaining] = useState(0);
  useEffect(() => {
    if (attempt.data) {
      setAnswers(Object.fromEntries(attempt.data.answers.map((a) => [a.questionId, a])));
      setRemaining(Math.max(0, Math.floor((new Date(attempt.data.expiresAt).getTime() - Date.now()) / 1000)));
    }
  }, [attempt.data]);
  useEffect(() => {
    const timer = setInterval(() => setRemaining((x) => Math.max(0, x - 1)), 1000),
      net = () => setOnline(navigator.onLine);
    addEventListener('online', net);
    addEventListener('offline', net);
    return () => {
      clearInterval(timer);
      removeEventListener('online', net);
      removeEventListener('offline', net);
    };
  }, []);
  const isRevision = attempt.data?.status === 'UNDER_REVIEW',
    revisionIds = new Set(
      attempt.data?.answers
        .filter((answer) => answer.reviewStatus === 'NEEDS_REVISION')
        .map((answer) => answer.questionId) ?? [],
    );
  const payload = (ids?: Set<string>) =>
    Object.entries(answers)
      .filter(([questionId]) => !ids || ids.has(questionId))
      .map(([questionId, a]) => ({
        questionId,
        value: a.value,
        textValue: a.textValue,
        fileId: a.fileId,
        flagged: a.flagged,
      }));
  const save = useMutation({
    mutationFn: () =>
      api(`/tests/attempts/${id}/answers`, { method: 'PATCH', body: JSON.stringify({ answers: payload() }) }),
  });
  async function saveAudio(questionId: string, fileId: string, flagged: boolean) {
    const next = { ...(answers[questionId] ?? { flagged }), fileId, flagged };
    setAnswers((current) => ({ ...current, [questionId]: next }));
    await api(`/tests/attempts/${id}/answers`, {
      method: 'PATCH',
      body: JSON.stringify({ answers: [{ questionId, ...next }] }),
    });
    await qc.invalidateQueries({ queryKey: ['attempt', id] });
  }
  useEffect(() => {
    if (isRevision || !Object.keys(answers).length || !online) return;
    const timer = setTimeout(() => save.mutate(), 800);
    return () => clearTimeout(timer);
  }, [answers, online, isRevision]);
  const section = isRevision
    ? attempt.data?.test.sections.find((candidate) =>
        candidate.questions.some((question) => revisionIds.has(question.id)),
      )
    : (attempt.data?.test.sections.find((s) => s.id === attempt.data?.currentSectionId) ??
      attempt.data?.test.sections[0]);
  const submit = useMutation({
    mutationFn: () => api(`/tests/attempts/${id}/submit`, { method: 'POST' }),
    onSuccess: () => router.replace(p('/dashboard/tests')),
  });
  const submitRevision = useMutation({
    mutationFn: () =>
      api(`/tests/attempts/${id}/answers`, {
        method: 'PATCH',
        body: JSON.stringify({ answers: payload(revisionIds) }),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['attempt', id] });
      router.replace(p('/dashboard/tests'));
    },
  });
  const sectionSubmit = useMutation({
    mutationFn: async () => {
      await api(`/tests/attempts/${id}/answers`, { method: 'PATCH', body: JSON.stringify({ answers: payload() }) });
      return api<{ finished: boolean }>(`/tests/attempts/${id}/sections/${section?.id}/submit`, { method: 'POST' });
    },
    onSuccess: async (result) => {
      if (result.finished) {
        if (confirm(translate(locale, 'testsessionAllSectionsAreLockedSubmitTheTestFor'))) submit.mutate();
      } else await qc.invalidateQueries({ queryKey: ['attempt', id] });
    },
  });
  if (attempt.isLoading) return <div className="skeleton min-h-screen" />;
  if (attempt.isError || !section)
    return (
      <main className="grid min-h-screen place-items-center">
        <p role="alert">{translate(locale, 'testsessionCouldNotRestoreTheTest')}</p>
      </main>
    );
  return (
    <main className="min-h-screen bg-[#f7f8fc]">
      <header className="flex justify-between bg-navy px-5 py-4 text-white">
        <p className="font-bold">LingoSpeak · {section.title}</p>
        <div className="flex gap-5">
          <span>
            {save.isPending
              ? translate(locale, 'teacherteacherAvailabilityManagerSaving')
              : save.isError
                ? translate(locale, 'testsessionSaveFailed')
                : translate(locale, 'testsessionSaved')}
          </span>
          <span className="latin">
            {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}
          </span>
        </div>
      </header>
      {!online && (
        <div className="flex justify-center gap-2 bg-amber-100 p-3">
          <WifiOff />
          {translate(locale, 'testsessionOfflineEditsWillRetryAfterReconnection')}
        </div>
      )}
      <div className="mx-auto max-w-4xl p-6 md:p-12">
        <div className="flex items-center justify-between gap-4">
          <h1 className="latin text-2xl font-bold">{section.skill}</h1>
          <span className="text-sm text-muted">
            {isRevision
              ? translate(locale, 'testsessionOnlyAnswersMarkedAsNeedingRevisionCanBe')
              : translate(locale, 'testsessionSubmittedSectionsCannotBeEdited')}
          </span>
        </div>
        <div className="mt-6 grid gap-5">
          {section.questions
            .filter((q) => !isRevision || revisionIds.has(q.id))
            .map((q) => (
              <QuestionView
                key={q.id}
                question={q}
                answer={answers[q.id]}
                fa={fa}
                setAnswer={(next) =>
                  setAnswers((current) => ({
                    ...current,
                    [q.id]: { ...current[q.id], ...next, flagged: next.flagged ?? !!current[q.id]?.flagged },
                  }))
                }
                saveAudio={(fileId) => saveAudio(q.id, fileId, !!answers[q.id]?.flagged)}
              />
            ))}
        </div>
        {isRevision ? (
          <button
            disabled={submitRevision.isPending || !online || !revisionIds.size}
            onClick={() => submitRevision.mutate()}
            className="brand-gradient mt-8 rounded-xl px-7 py-4 font-bold text-white disabled:opacity-50"
          >
            {submitRevision.isPending
              ? translate(locale, 'testsessionSubmittingRevisions')
              : translate(locale, 'testsessionSubmitRevisedAnswers')}
          </button>
        ) : (
          <button
            disabled={sectionSubmit.isPending || submit.isPending || save.isPending || !online}
            onClick={() => sectionSubmit.mutate()}
            className="brand-gradient mt-8 rounded-xl px-7 py-4 font-bold text-white disabled:opacity-50"
          >
            {sectionSubmit.isPending
              ? translate(locale, 'testsessionSavingAndLocking')
              : translate(locale, 'testsessionSubmitAndLockThisSection')}
          </button>
        )}
        {(sectionSubmit.isError || submit.isError || submitRevision.isError) && (
          <p role="alert" className="mt-4 text-red-700">
            {apiMessage(
              sectionSubmit.error ?? submit.error ?? submitRevision.error,
              translate(locale, 'testsessionCouldNotSubmitTheAnswerCorrectTheForm'),
            )}
          </p>
        )}
      </div>
    </main>
  );
}
function QuestionView({
  question: q,
  answer,
  setAnswer,
  saveAudio,
  fa,
}: {
  question: Question;
  answer?: Answer;
  setAnswer: (answer: Partial<Answer>) => void;
  saveAudio: (fileId: string) => Promise<void>;
  fa: boolean;
}) {
  const choices = Array.isArray(q.choices)
      ? q.choices
      : (localized({ fa: q.choices?.fa, en: q.choices?.en }, fa) ?? []),
    prompt = localized({ fa: q.prompt.fa, en: q.prompt.en }, fa) ?? q.prompt.fa ?? q.prompt.en;
  return (
    <article className="rounded-3xl bg-white p-7">
      <div className="flex justify-between">
        <p className="font-bold">
          {translate(fa, 'testsessionQuestion')} {q.order}
        </p>
        <button
          type="button"
          onClick={() => setAnswer({ flagged: !answer?.flagged })}
          aria-label={translate(fa, 'testsessionFlag')}
        >
          <Flag fill={answer?.flagged ? '#a78bfa' : 'none'} />
        </button>
      </div>
      <p className="mt-5">{prompt}</p>
      {answer?.reviewStatus === 'NEEDS_REVISION' && (answer.feedbackFa || answer.feedbackEn) && (
        <div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm leading-7 text-amber-900">
          <strong className="block">{translate(fa, 'testsessionExaminerFeedback')}</strong>
          {localized({ fa: answer.feedbackFa, en: answer.feedbackEn }, fa) ?? answer.feedbackFa ?? answer.feedbackEn}
        </div>
      )}
      {['single_choice', 'true_false'].includes(q.type) ? (
        <div className="mt-5 grid gap-2">
          {choices.map((choice, index) => (
            <label key={`${index}-${choice}`} className="rounded-xl border hairline p-3">
              <input
                type="radio"
                name={q.id}
                checked={answer?.value === index}
                onChange={() => setAnswer({ value: index })}
              />{' '}
              {choice}
            </label>
          ))}
        </div>
      ) : q.type === 'multiple_choice' ? (
        <div className="mt-5 grid gap-2">
          {choices.map((choice, index) => {
            const selected = Array.isArray(answer?.value) ? (answer.value as number[]) : [];
            return (
              <label key={`${index}-${choice}`} className="rounded-xl border hairline p-3">
                <input
                  type="checkbox"
                  checked={selected.includes(index)}
                  onChange={(e) =>
                    setAnswer({ value: e.target.checked ? [...selected, index] : selected.filter((x) => x !== index) })
                  }
                />{' '}
                {choice}
              </label>
            );
          })}
        </div>
      ) : q.type === 'recording' ? (
        <AudioRecorder value={answer?.fileId} onUploaded={saveAudio} />
      ) : (
        <div>
          <textarea
            aria-label={`${translate(fa, 'testsessionAnswer')} ${q.order}`}
            value={answer?.textValue ?? ''}
            onChange={(e) => setAnswer({ textValue: e.target.value })}
            className="mt-5 min-h-52 w-full rounded-2xl border hairline p-4"
          />
          <p className="mt-2 text-xs text-muted">
            {(answer?.textValue ?? '').trim().split(/\s+/).filter(Boolean).length} {translate(fa, 'testsessionWords')}
          </p>
        </div>
      )}
    </article>
  );
}
