'use client';
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Heart, MessageCircle, Reply } from 'lucide-react';
import { api, publicApi } from '@/shared/services/api';
type Comment = { id: string; body: string; createdAt: string; user?: { name?: string }; replies: Comment[] };
export function BlogDiscussion({ postId }: { postId: string }) {
  const qc = useQueryClient(),
    [notice, setNotice] = useState(''),
    comments = useQuery({
      queryKey: ['blog-comments', postId],
      queryFn: () => publicApi<Comment[]>(`/blog/posts/${postId}/comments`),
    }),
    react = useMutation({
      mutationFn: () =>
        api(`/blog/posts/${postId}/reaction`, { method: 'POST', body: JSON.stringify({ type: 'LIKE' }) }),
      onSuccess: () => setNotice('پسند شما ثبت شد.'),
      onError: () => setNotice('برای پسندیدن مقاله وارد حساب شوید.'),
    }),
    comment = useMutation({
      mutationFn: (payload: { body: string; parentId?: string }) =>
        api(`/blog/posts/${postId}/comments`, { method: 'POST', body: JSON.stringify(payload) }),
      onSuccess: () => setNotice('دیدگاه شما ثبت شد و پس از بررسی نمایش داده می‌شود.'),
      onError: () => setNotice('برای ثبت دیدگاه وارد حساب شوید.'),
    });
  function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      body = String(new FormData(form).get('body') ?? '').trim();
    if (body) {
      comment.mutate({ body });
      form.reset();
    }
  }
  return (
    <section className="mt-10 border-t hairline pt-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="flex items-center gap-2 text-2xl font-black">
          <MessageCircle className="text-purple" />
          گفت‌وگوی محله
        </h2>
        <button onClick={() => react.mutate()} className="secondary-button">
          <Heart size={18} />
          پسندیدن
        </button>
      </div>
      {notice && (
        <p aria-live="polite" className="mt-4 rounded-xl bg-lavender p-3 text-sm text-purple">
          {notice}{' '}
          {notice.includes('وارد') && (
            <Link href="/auth" className="font-black underline">
              ورود
            </Link>
          )}
        </p>
      )}
      <form onSubmit={send} className="mt-5 rounded-2xl border hairline bg-white p-4">
        <textarea
          name="body"
          required
          maxLength={1500}
          rows={3}
          className="input resize-none"
          placeholder="دیدگاه یا تجربه‌ات درباره این موضوع را بنویس..."
        />
        <div className="mt-3 flex justify-end">
          <button disabled={comment.isPending} className="primary-button">
            ثبت دیدگاه
          </button>
        </div>
      </form>
      {comments.isLoading && <div className="skeleton mt-5 h-32 rounded-2xl" />}
      {comments.isError && (
        <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-red-700">
          دریافت دیدگاه‌ها ناموفق بود.
        </p>
      )}
      <div className="mt-5 grid gap-3">
        {comments.data?.length
          ? comments.data.map((item) => (
              <CommentCard item={item} postId={postId} submit={(payload) => comment.mutate(payload)} key={item.id} />
            ))
          : comments.data && (
              <div className="rounded-2xl border border-dashed hairline p-8 text-center text-muted">
                هنوز دیدگاهی منتشر نشده است.
              </div>
            )}
      </div>
    </section>
  );
}
function CommentCard({
  item,
  postId,
  submit,
}: {
  item: Comment;
  postId: string;
  submit: (x: { body: string; parentId: string }) => void;
}) {
  const [reply, setReply] = useState(false);
  function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      body = String(new FormData(form).get('body') ?? '').trim();
    if (body) {
      submit({ body, parentId: item.id });
      form.reset();
      setReply(false);
    }
  }
  return (
    <article className="rounded-2xl border hairline bg-white p-5">
      <div className="flex justify-between gap-3">
        <strong>{item.user?.name ?? 'کاربر لینگواسپیک'}</strong>
        <time className="text-xs text-muted">{new Date(item.createdAt).toLocaleDateString('fa-IR')}</time>
      </div>
      <p className="mt-3 text-sm leading-7">{item.body}</p>
      <button
        onClick={() => setReply((x) => !x)}
        className="mt-3 flex items-center gap-2 text-xs font-bold text-purple"
      >
        <Reply size={14} />
        پاسخ
      </button>
      {reply && (
        <form onSubmit={send} className="mt-3 flex gap-2">
          <input name="body" required maxLength={1500} className="input" placeholder="پاسخ شما" />
          <button className="primary-button">ارسال</button>
        </form>
      )}
      {item.replies?.map((child) => (
        <div key={child.id} className="mt-4 border-r-2 border-purple/25 pr-4">
          <strong className="text-xs text-purple">{child.user?.name ?? 'کاربر'}</strong>
          <p className="mt-2 text-sm leading-7">{child.body}</p>
        </div>
      ))}
    </article>
  );
}
