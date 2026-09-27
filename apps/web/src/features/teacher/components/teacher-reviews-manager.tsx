'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiMessage } from '@/shared/services/api';
import { useTranslations } from '@/components/shared/locale-provider';

type Review = {
  id: string;
  rating: number;
  comment: string | null;
  teacherResponse: string | null;
  respondedAt: string | null;
  createdAt: string;
  student: { name: string | null };
};

export function TeacherReviewsManager() {
  const { locale } = useTranslations(),
    fa = locale === 'fa',
    qc = useQueryClient(),
    [drafts, setDrafts] = useState<Record<string, string>>({}),
    [editing, setEditing] = useState<Record<string, boolean>>({});
  const reviews = useQuery({
    queryKey: ['/reviews/mine'],
    queryFn: () => api<{ data: Review[]; total: number }>('/reviews/mine?limit=50'),
  });
  const reply = useMutation({
    mutationFn: ({ id, response }: { id: string; response: string }) =>
      api(`/reviews/${id}/reply`, { method: 'POST', body: JSON.stringify({ response }) }),
    onSuccess: (_data, { id }) => {
      setEditing((current) => ({ ...current, [id]: false }));
      return qc.invalidateQueries({ queryKey: ['/reviews/mine'] });
    },
  });
  const date = (value: string) =>
    new Intl.DateTimeFormat(fa ? 'fa-IR' : 'en-US', { dateStyle: 'medium' }).format(new Date(value));

  return (
    <section className="grid gap-6">
      <div>
        <p className="text-sm font-bold text-purple">{fa ? 'بازخورد زبان‌آموزان' : 'Learner feedback'}</p>
        <h1 className="mt-2 text-3xl font-black">{fa ? 'نظرات و امتیازها' : 'Reviews and ratings'}</h1>
        <p className="mt-2 text-muted">
          {fa ? 'می‌توانید به نظرات منتشرشده زبان‌آموزان پاسخ بدهید.' : 'You can respond to your published reviews.'}
        </p>
      </div>
      {reviews.isError && (
        <div role="alert" className="rounded-2xl bg-red-50 p-4 text-red-700">
          {fa ? 'بارگذاری نظرات ناموفق بود.' : 'Could not load reviews.'}
        </div>
      )}
      <div className="grid gap-4">
        {(reviews.data?.data ?? []).map((review) => {
          const isEditing = editing[review.id] ?? !review.teacherResponse;
          return (
            <article key={review.id} className="overflow-hidden rounded-3xl border hairline bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b hairline bg-slate-50/70 px-5 py-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-2xl bg-primary/10 text-lg text-primary">
                    ★
                  </span>
                  <div>
                    <strong className="block">{review.student.name || (fa ? 'زبان‌آموز' : 'Student')}</strong>
                    <span className="text-xs text-muted">{date(review.createdAt)}</span>
                  </div>
                  <span className="text-amber-500" aria-label={`${review.rating} / 5`}>
                    {'★'.repeat(review.rating)}
                    {'☆'.repeat(5 - review.rating)}
                  </span>
                </div>
              </div>
              <div className="grid gap-5 p-5 lg:grid-cols-[1fr_18rem]">
                <p className="whitespace-pre-wrap leading-8 text-ink">
                  {review.comment || (fa ? 'بدون متن' : 'No comment')}
                </p>
                <div className="rounded-2xl bg-canvas p-3">
                  {review.teacherResponse && !isEditing ? (
                    <div>
                      <label className="mb-2 block text-xs font-bold text-muted">
                        {fa ? 'پاسخ شما' : 'Your reply'}
                      </label>
                      <p className="whitespace-pre-wrap rounded-xl border hairline bg-white p-3 text-sm leading-7">
                        {review.teacherResponse}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setDrafts((current) => ({ ...current, [review.id]: review.teacherResponse ?? '' }));
                          setEditing((current) => ({ ...current, [review.id]: true }));
                        }}
                        className="mt-3 w-full rounded-xl border hairline bg-white px-3 py-2 text-sm font-bold"
                      >
                        {fa ? 'ویرایش پاسخ' : 'Edit reply'}
                      </button>
                    </div>
                  ) : (
                    <div>
                      <label className="mb-2 block text-xs font-bold text-muted">
                        {fa ? 'پاسخ به این نظر' : 'Reply to this review'}
                      </label>
                      <textarea
                        value={drafts[review.id] ?? review.teacherResponse ?? ''}
                        onChange={(e) => setDrafts((current) => ({ ...current, [review.id]: e.target.value }))}
                        className="min-h-24 w-full rounded-xl border hairline bg-white p-3 text-sm outline-none focus:border-primary"
                        placeholder={fa ? 'پاسخ خود را بنویسید…' : 'Write your reply…'}
                      />
                      {reply.isError && reply.variables?.id === review.id && (
                        <p className="mt-2 text-xs text-danger" role="alert">
                          {apiMessage(reply.error, fa ? 'ارسال پاسخ ناموفق بود.' : 'Could not send the reply.')}
                        </p>
                      )}
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          disabled={reply.isPending || !(drafts[review.id] ?? '').trim()}
                          onClick={() => reply.mutate({ id: review.id, response: (drafts[review.id] ?? '').trim() })}
                          className="flex-1 rounded-xl bg-ink px-3 py-2 text-sm font-black text-white disabled:opacity-50"
                        >
                          {fa ? 'ارسال پاسخ' : 'Send reply'}
                        </button>
                        {review.teacherResponse && (
                          <button
                            type="button"
                            onClick={() => setEditing((current) => ({ ...current, [review.id]: false }))}
                            className="rounded-xl border hairline bg-white px-3 py-2 text-sm font-bold"
                          >
                            {fa ? 'انصراف' : 'Cancel'}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </article>
          );
        })}
        {!reviews.isLoading && !reviews.data?.data?.length && (
          <div className="rounded-2xl border border-dashed hairline p-10 text-center text-muted">
            {fa ? 'هنوز نظری ثبت نشده است.' : 'No reviews yet.'}
          </div>
        )}
        {reviews.isLoading && (
          <div className="grid gap-4">
            <div className="skeleton h-40 rounded-3xl" />
            <div className="skeleton h-40 rounded-3xl" />
          </div>
        )}
      </div>
    </section>
  );
}
