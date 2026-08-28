'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { BadgeCheck, MessageSquareText, Star, Trash2, X } from 'lucide-react';
import { api, apiMessage, readAccessToken } from '@/shared/services/api';
import { applyRatingChange } from './review-state';

export type PublicReview = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  isVerified?: boolean;
  moderationStatus?: string;
  student?: { name?: string | null; avatarKey?: string | null };
  user?: { name?: string | null; avatarKey?: string | null };
};

type Props = {
  subject: 'teacher' | 'course';
  subjectId: string;
  title: string;
  rating: number;
  count: number;
  reviews: PublicReview[];
  distribution?: Record<string, number>;
};

const formatDate = (value: string) => new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium' }).format(new Date(value));

function Stars({ value, label = true }: { value: number; label?: boolean }) {
  return (
    <span
      className="inline-flex gap-0.5"
      dir="ltr"
      aria-label={label ? `${value} ستاره از ۵` : undefined}
      aria-hidden={label ? undefined : true}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={18}
          className={star <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}
        />
      ))}
    </span>
  );
}

function StarInput({ value, onChange }: { value: number; onChange: (rating: number) => void }) {
  return (
    <fieldset>
      <legend className="mb-3 font-bold">امتیاز شما</legend>
      <div className="flex w-fit gap-1" dir="ltr">
        {[1, 2, 3, 4, 5].map((star) => (
          <label key={star} className="cursor-pointer rounded-lg p-1 focus-within:ring-2 focus-within:ring-purple">
            <input
              className="sr-only"
              type="radio"
              name="rating"
              value={star}
              checked={value === star}
              onChange={() => onChange(star)}
            />
            <Star
              size={32}
              aria-hidden="true"
              className={star <= value ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}
            />
            <span className="sr-only">{star} ستاره از ۵</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function ReviewSection({ subject, subjectId, title, rating, count, reviews, distribution }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [mine, setMine] = useState<PublicReview | null>(null);
  const [bookingId, setBookingId] = useState<string>();
  const [eligible, setEligible] = useState(false);
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [visibleReviews, setVisibleReviews] = useState(reviews);
  const [summary, setSummary] = useState({ rating, count, distribution: distribution ?? {} });
  const rows = useMemo(
    () =>
      [5, 4, 3, 2, 1].map((star) => ({
        star,
        count: summary.distribution[star] ?? visibleReviews.filter((r) => r.rating === star).length,
      })),
    [summary.distribution, visibleReviews],
  );

  useEffect(() => {
    if (!dialog.current?.open) return;
    const close = () => dialog.current?.close();
    dialog.current.addEventListener('cancel', close);
    return () => dialog.current?.removeEventListener('cancel', close);
  }, []);

  async function open() {
    if (!readAccessToken()) {
      window.location.href = `/auth?next=${encodeURIComponent(window.location.pathname)}`;
      return;
    }
    setStatus('در حال بررسی امکان ثبت نظر…');
    setScore(0);
    setComment('');
    setMine(null);
    setEligible(false);
    dialog.current?.showModal();
    try {
      if (subject === 'teacher') {
        const result = await api<{ eligible: boolean; booking?: { id: string }; review?: PublicReview }>(
          `/reviews/teacher/${subjectId}/eligibility`,
        );
        setEligible(result.eligible);
        setBookingId(result.booking?.id);
        setMine(result.review ?? null);
        if (result.review) {
          setScore(result.review.rating);
          setComment(result.review.comment ?? '');
        }
        setStatus(
          result.review ? '' : result.eligible ? '' : 'پس از برگزاری موفق کلاس می‌توانید برای این مدرس نظر ثبت کنید.',
        );
      } else {
        const result = await api<{ eligible: boolean; review: PublicReview | null }>(
          `/courses/${subjectId}/review-eligibility`,
        );
        setMine(result.review);
        setEligible(result.eligible);
        if (result.review) {
          setScore(result.review.rating);
          setComment(result.review.comment ?? '');
        }
        setStatus(result.eligible ? '' : 'برای ثبت نظر باید در این دوره ثبت‌نام کرده باشید.');
      }
    } catch (error) {
      setEligible(false);
      setStatus(
        apiMessage(
          error,
          subject === 'course' ? 'برای ثبت نظر باید در این دوره ثبت‌نام کرده باشید.' : 'امکان ثبت نظر بررسی نشد.',
        ),
      );
    }
  }

  async function save() {
    if (!score || comment.trim().length < (subject === 'course' ? 10 : 2)) {
      setStatus('یک امتیاز و نظر کامل وارد کنید.');
      return;
    }
    setBusy(true);
    setStatus('');
    try {
      const path = mine
        ? subject === 'teacher'
          ? `/reviews/${mine.id}`
          : `/courses/reviews/${mine.id}`
        : subject === 'teacher'
          ? '/reviews'
          : `/courses/${subjectId}/reviews`;
      const body = subject === 'teacher' && !mine ? { bookingId, rating: score, comment } : { rating: score, comment };
      const saved = await api<PublicReview>(path, {
        method: mine ? 'PATCH' : 'POST',
        body: JSON.stringify(body),
      });
      if (subject === 'course') {
        setSummary((current) => applyRatingChange(current, mine?.rating ?? null, saved.rating));
        setVisibleReviews((current) => [saved, ...current.filter((review) => review.id !== saved.id)]);
      }
      setMine(saved);
      setScore(saved.rating);
      setComment(saved.comment ?? '');
      setStatus(
        subject === 'teacher'
          ? 'نظر شما ثبت شد و پس از بررسی منتشر می‌شود.'
          : mine
            ? 'نظر شما ویرایش شد.'
            : 'نظر شما با موفقیت ثبت شد.',
      );
    } catch (error) {
      setStatus(apiMessage(error, 'ثبت نظر ناموفق بود.'));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!mine || !window.confirm('آیا از حذف این نظر مطمئن هستید؟')) return;
    setBusy(true);
    try {
      await api(subject === 'teacher' ? `/reviews/${mine.id}` : `/courses/reviews/${mine.id}`, { method: 'DELETE' });
      if (subject === 'course') {
        setSummary((current) => applyRatingChange(current, mine.rating, null));
        setVisibleReviews((current) => current.filter((review) => review.id !== mine.id));
      }
      setMine(null);
      setScore(0);
      setComment('');
      setStatus('نظر شما حذف شد.');
    } catch (error) {
      setStatus(apiMessage(error, 'حذف نظر ناموفق بود.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="review-section" aria-labelledby={`${subject}-reviews-title`}>
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-black text-purple">تجربه واقعی زبان‌آموزها</p>
          <h2 id={`${subject}-reviews-title`} className="mt-2 text-2xl font-black md:text-3xl">
            {title}
          </h2>
        </div>
        <button onClick={open} className="primary-button justify-center">
          <MessageSquareText size={18} />
          ثبت نظر و امتیاز
        </button>
      </div>
      <div className="mt-7 grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="rating-summary">
          <strong className="latin text-5xl font-black">{summary.count ? summary.rating.toFixed(1) : '—'}</strong>
          <Stars value={summary.rating} />
          <p className="text-sm text-muted">بر اساس {summary.count.toLocaleString('fa-IR')} نظر</p>
          <div className="mt-5 grid gap-2">
            {rows.map((row) => (
              <div key={row.star} className="grid grid-cols-[34px_1fr_32px] items-center gap-2 text-xs">
                <span className="latin">{row.star} ★</span>
                <span className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <span
                    className="block h-full rounded-full bg-amber-400"
                    style={{ width: `${summary.count ? (row.count / summary.count) * 100 : 0}%` }}
                  />
                </span>
                <span className="text-muted">{summary.count ? Math.round((row.count / summary.count) * 100) : 0}٪</span>
              </div>
            ))}
          </div>
        </div>
        <div className="grid gap-4">
          {visibleReviews.length ? (
            visibleReviews.map((review) => {
              const person = review.student ?? review.user;
              return (
                <article key={review.id} className="review-card">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <strong>{person?.name || 'زبان‌آموز لینگواسپیک'}</strong>
                      {(review.isVerified ?? subject === 'teacher') && (
                        <span className="ms-2 inline-flex items-center gap-1 text-xs font-bold text-green">
                          <BadgeCheck size={14} />
                          تجربه تأییدشده
                        </span>
                      )}
                    </div>
                    <time className="text-xs text-muted">{formatDate(review.createdAt)}</time>
                  </div>
                  <div className="mt-3">
                    <Stars value={review.rating} />
                  </div>
                  <p className="mt-3 leading-8 text-slate-700">{review.comment}</p>
                </article>
              );
            })
          ) : (
            <div className="review-empty">
              <MessageSquareText size={30} />
              <strong>هنوز نظری ثبت نشده</strong>
              <p>اولین تجربه مفید را شما با دیگر زبان‌آموزها به اشتراک بگذارید.</p>
            </div>
          )}
        </div>
      </div>
      <dialog ref={dialog} className="review-dialog" aria-labelledby="review-dialog-title">
        <form method="dialog" className="flex items-center justify-between border-b hairline p-5">
          <h3 id="review-dialog-title" className="text-xl font-black">
            {mine ? 'ویرایش نظر شما' : 'ثبت نظر و امتیاز'}
          </h3>
          <button aria-label="بستن" className="rounded-lg p-2 hover:bg-slate-100">
            <X />
          </button>
        </form>
        <div className="grid gap-5 p-5">
          <StarInput value={score} onChange={setScore} />
          <label className="grid gap-2 font-bold">
            نظر شما
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              minLength={subject === 'course' ? 10 : 2}
              maxLength={3000}
              rows={5}
              className="input resize-none font-normal"
              placeholder={
                subject === 'teacher'
                  ? 'تجربه شما از کلاس با این مدرس چطور بود؟'
                  : 'این دوره چطور به یادگیری شما کمک کرد؟'
              }
            />
          </label>
          {status && (
            <p role="status" className="rounded-xl bg-lavender p-3 text-sm text-purple">
              {status}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={save}
              disabled={busy || (!eligible && !mine)}
              className="primary-button disabled:cursor-not-allowed disabled:opacity-45"
            >
              {busy ? 'در حال ثبت…' : mine ? 'ذخیره تغییرات' : 'ثبت نظر'}
            </button>
            {mine && (
              <button type="button" onClick={remove} disabled={busy} className="secondary-button text-red-600">
                <Trash2 size={17} />
                حذف نظر
              </button>
            )}
          </div>
        </div>
      </dialog>
    </section>
  );
}
