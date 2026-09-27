'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/services/api';
import { Sheet } from '@/shared/components/ui';

type Comment = {
  id: string;
  body: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  user: { id: string; name: string | null } | null;
  replies: Comment[];
};

const statuses = [
  ['PENDING', 'در انتظار بررسی'],
  ['APPROVED', 'تأییدشده'],
  ['REJECTED', 'ردشده'],
] as const;

type Moderate = ReturnType<typeof useModerateMutation>;

function useModerateMutation(articleId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, next }: { id: string; next: 'APPROVED' | 'REJECTED' }) =>
      api(`/blog/comments/${id}/moderate`, { method: 'PATCH', body: JSON.stringify({ status: next }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['article-comments', articleId] }),
  });
}

export function ArticleCommentsPanel({
  articleId,
  title,
  onClose,
}: {
  articleId: string;
  title: string;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<(typeof statuses)[number][0]>('PENDING');
  const comments = useQuery({
    queryKey: ['article-comments', articleId, status],
    queryFn: () =>
      api<{ data: Comment[]; total: number }>(`/blog/posts/${articleId}/comments/queue?status=${status}&limit=50`),
  });
  const moderate = useModerateMutation(articleId);

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()} title={title} className="sm:max-w-2xl">
      <p className="-mt-2 text-sm font-bold text-purple">نظرات مقاله</p>
      <div className="mt-5 flex flex-wrap gap-2" role="tablist">
        {statuses.map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setStatus(value)}
            className={`rounded-full px-4 py-2 text-sm font-bold ${status === value ? 'bg-ink text-white' : 'border hairline bg-white'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {comments.isError && (
        <div role="alert" className="mt-5 rounded-2xl bg-red-50 p-4 text-red-700">
          بارگذاری نظرات ناموفق بود.
        </div>
      )}
      <div className="mt-5 grid gap-3">
        {(comments.data?.data ?? []).map((comment) => (
          <CommentCard key={comment.id} comment={comment} moderate={moderate} />
        ))}
        {!comments.isLoading && !comments.data?.data?.length && (
          <div className="rounded-2xl border border-dashed hairline p-8 text-center text-muted">
            نظری در این وضعیت نیست.
          </div>
        )}
      </div>
    </Sheet>
  );
}

function CommentCard({ comment, moderate, nested }: { comment: Comment; moderate: Moderate; nested?: boolean }) {
  return (
    <div className={`rounded-2xl border hairline p-4 ${nested ? 'mr-6 bg-canvas' : 'bg-white'}`}>
      <div className="flex items-center justify-between gap-3">
        <strong className="text-sm">{comment.user?.name ?? 'کاربر حذف‌شده'}</strong>
        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-black">
          {statuses.find(([value]) => value === comment.status)?.[1]}
        </span>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-7">{comment.body}</p>
      <div className="mt-3 flex gap-2">
        {comment.status !== 'APPROVED' && (
          <button
            disabled={moderate.isPending}
            onClick={() => moderate.mutate({ id: comment.id, next: 'APPROVED' })}
            className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-black text-white"
          >
            تأیید
          </button>
        )}
        {comment.status !== 'REJECTED' && (
          <button
            disabled={moderate.isPending}
            onClick={() => moderate.mutate({ id: comment.id, next: 'REJECTED' })}
            className="rounded-xl bg-danger-soft px-3 py-1.5 text-xs font-black text-danger"
          >
            رد کردن
          </button>
        )}
      </div>
      {comment.replies?.length > 0 && (
        <div className="mt-3 grid gap-2">
          {comment.replies.map((reply) => (
            <CommentCard key={reply.id} comment={reply} moderate={moderate} nested />
          ))}
        </div>
      )}
    </div>
  );
}
