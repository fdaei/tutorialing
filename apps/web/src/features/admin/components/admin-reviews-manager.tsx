'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/services/api';
import { useTranslations } from '@/components/shared/locale-provider';

type Review = {
  id: string; rating: number; comment: string | null; moderationStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'NEEDS_REVISION';
  rejectionReason?: string | null; createdAt: string;
  student: { name: string | null; phone: string };
  teacher: { nameFa: string; nameEn: string; slug: string };
};

const statuses = [
  ['PENDING', 'در انتظار بررسی', 'Pending'],
  ['APPROVED', 'تأییدشده', 'Approved'],
  ['REJECTED', 'ردشده', 'Rejected'],
  ['NEEDS_REVISION', 'نیازمند اصلاح', 'Needs revision'],
] as const;

export function AdminReviewsManager() {
  const { locale } = useTranslations(), fa = locale === 'fa', qc = useQueryClient();
  const [status, setStatus] = useState('PENDING');
  const [note, setNote] = useState<Record<string, string>>({});
  const reviews = useQuery({
    queryKey: ['admin-reviews', status],
    queryFn: () => api<{ data: Review[]; total: number }>(`/admin/reviews?status=${status}&limit=50`),
  });
  const moderate = useMutation({
    mutationFn: ({ id, next }: { id: string; next: 'APPROVED' | 'REJECTED' | 'NEEDS_REVISION' }) =>
      api(`/admin/reviews/${id}/moderate`, { method: 'POST', body: JSON.stringify({ status: next, note: note[id] || undefined }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-reviews'] }),
  });
  const label = (item: (typeof statuses)[number]) => fa ? item[1] : item[2];
  return (
    <section className="grid gap-6">
      <div>
        <p className="text-sm font-bold text-purple">{fa ? 'مدیریت محتوای کاربران' : 'User content moderation'}</p>
        <h1 className="mt-2 text-3xl font-black">{fa ? 'نظرات مدرس‌ها' : 'Teacher reviews'}</h1>
        <p className="mt-2 text-muted">{fa ? 'نظرات را قبل از انتشار بررسی و نتیجه را ثبت کنید.' : 'Review learner feedback before it appears publicly.'}</p>
      </div>
      <div className="flex flex-wrap gap-2" role="tablist">
        {statuses.map((item) => <button key={item[0]} type="button" onClick={() => setStatus(item[0])} className={`rounded-full px-4 py-2 text-sm font-bold ${status === item[0] ? 'bg-ink text-white' : 'border hairline bg-white'}`}>{label(item)}</button>)}
      </div>
      {reviews.isError && <div role="alert" className="rounded-2xl bg-red-50 p-4 text-red-700">{fa ? 'بارگذاری نظرات ناموفق بود.' : 'Could not load reviews.'}</div>}
      <div className="grid gap-4">
        {(reviews.data?.data ?? []).map((review) => <article key={review.id} className="overflow-hidden rounded-3xl border hairline bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b hairline bg-slate-50/70 px-5 py-4">
            <div className="flex flex-wrap items-center gap-3"><span className="grid size-10 place-items-center rounded-2xl bg-primary/10 text-lg text-primary">★</span><div><strong className="block">{fa ? review.teacher.nameFa : review.teacher.nameEn}</strong><span className="text-xs text-muted">{review.student.name || review.student.phone}</span></div><span className="text-amber-500" aria-label={`${review.rating} / 5`}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span></div>
            <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-black">{statuses.find((item) => item[0] === review.moderationStatus)?.[fa ? 1 : 2]}</span>
          </div>
          <div className="grid gap-5 p-5 lg:grid-cols-[1fr_18rem]">
            <div><p className="whitespace-pre-wrap leading-8 text-ink">{review.comment || (fa ? 'بدون متن' : 'No comment')}</p>{review.rejectionReason && <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm leading-6 text-red-700"><b>{fa ? 'یادداشت بررسی:' : 'Review note:'}</b> {review.rejectionReason}</p>}</div>
            <div className="rounded-2xl bg-canvas p-3"><label className="mb-2 block text-xs font-bold text-muted">{fa ? 'یادداشت تغییر وضعیت' : 'Status change note'}</label><textarea value={note[review.id] ?? ''} onChange={(e) => setNote((current) => ({ ...current, [review.id]: e.target.value }))} className="min-h-20 w-full rounded-xl border hairline bg-white p-3 text-sm outline-none focus:border-primary" placeholder={fa ? 'برای رد کردن الزامی است' : 'Required when rejecting'} /><div className="mt-3 grid grid-cols-2 gap-2">
              {review.moderationStatus !== 'APPROVED' && <button disabled={moderate.isPending} onClick={() => moderate.mutate({ id: review.id, next: 'APPROVED' })} className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-black text-white">{fa ? 'تأیید' : 'Approve'}</button>}
              {review.moderationStatus !== 'REJECTED' && <button disabled={moderate.isPending || !note[review.id]?.trim()} onClick={() => moderate.mutate({ id: review.id, next: 'REJECTED' })} className="rounded-xl bg-danger-soft px-3 py-2 text-sm font-black text-danger">{fa ? 'رد کردن' : 'Reject'}</button>}
              {review.moderationStatus !== 'NEEDS_REVISION' && <button disabled={moderate.isPending || !note[review.id]?.trim()} onClick={() => moderate.mutate({ id: review.id, next: 'NEEDS_REVISION' })} className="col-span-2 rounded-xl border hairline bg-white px-3 py-2 text-sm font-bold">{fa ? 'نیازمند اصلاح' : 'Needs revision'}</button>}
            </div></div>
          </div>
        </article>)}
        {!reviews.isLoading && !reviews.data?.data?.length && <div className="rounded-2xl border border-dashed hairline p-10 text-center text-muted">{fa ? 'نظری در این وضعیت نیست.' : 'No reviews in this status.'}</div>}
      </div>
    </section>
  );
}
