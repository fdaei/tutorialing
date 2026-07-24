'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiMessage } from '@/lib/api';
import { useTranslations } from './locale-provider';

type Ticket = {
  id: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  createdAt?: string;
  updatedAt: string;
  replies: { id?: string; body: string; createdAt?: string; authorRole?: string; author?: { name?: string } }[];
};
type TicketPage = { items: Ticket[]; pagination: { total: number; pages: number } };

export function MyTicketManager() {
  const { locale } = useTranslations();
  const fa = locale === 'fa';
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string>();
  const [body, setBody] = useState('');
  const list = useQuery({ queryKey: ['my-tickets'], queryFn: () => api<TicketPage>('/support/tickets?pageSize=100') });
  const detail = useQuery({
    queryKey: ['my-ticket', selectedId],
    queryFn: () => api<Ticket>(`/support/tickets/${selectedId}`),
    enabled: !!selectedId,
  });
  const reply = useMutation({
    mutationFn: () => api(`/support/tickets/${selectedId}/replies`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    }),
    onSuccess: async () => {
      setBody('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['my-tickets'] }),
        queryClient.invalidateQueries({ queryKey: ['my-ticket', selectedId] }),
      ]);
    },
  });

  return <section className="mt-7">
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-2xl font-black">{fa ? 'تیکت‌های من' : 'My tickets'}</h2>
      <span className="rounded-full bg-lavender px-3 py-1 text-sm font-black text-purple">{list.data?.pagination.total ?? 0}</span>
    </div>
    {list.isLoading && <div className="skeleton h-40 rounded-3xl" />}
    {list.isError && <ErrorBox message={apiMessage(list.error, fa ? 'تیکت‌های شما دریافت نشد.' : 'Could not load your tickets.')} retry={() => list.refetch()} />}
    {list.data && !list.data.items.length && <div className="rounded-3xl border border-dashed hairline p-10 text-center text-muted">{fa ? 'هنوز تیکتی ثبت نکرده‌اید.' : 'You have not created a ticket yet.'}</div>}
    {!!list.data?.items.length && <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
      <div className="grid content-start gap-3">{list.data.items.map((ticket) =>
        <button key={ticket.id} onClick={() => setSelectedId(ticket.id)} className={`rounded-2xl border p-4 text-start ${selectedId === ticket.id ? 'border-purple bg-lavender/40' : 'hairline bg-white'}`}>
          <div className="flex items-start justify-between gap-3"><strong>{ticket.subject}</strong><Status value={ticket.status} fa={fa} /></div>
          <p className="mt-2 text-sm text-muted">{ticket.category} · {ticket.priority}</p>
          <p className="mt-2 line-clamp-2 text-sm">{ticket.replies[0]?.body}</p>
        </button>)}
      </div>
      <div className="rounded-3xl border hairline bg-white p-5">
        {!selectedId && <p className="py-16 text-center text-muted">{fa ? 'برای مشاهده گفتگو یک تیکت را انتخاب کنید.' : 'Select a ticket to view the conversation.'}</p>}
        {detail.isLoading && <div className="skeleton h-64 rounded-2xl" />}
        {detail.isError && <ErrorBox message={apiMessage(detail.error, fa ? 'جزئیات تیکت دریافت نشد.' : 'Could not load ticket details.')} retry={() => detail.refetch()} />}
        {detail.data && <div>
          <div className="flex items-start justify-between gap-4"><div><p className="text-sm text-muted">{detail.data.category}</p><h3 className="mt-1 text-xl font-black">{detail.data.subject}</h3></div><Status value={detail.data.status} fa={fa} /></div>
          <div className="mt-6 grid gap-3">{detail.data.replies.map((message, index) => <article key={message.id ?? index} className={`rounded-2xl p-4 ${message.authorRole === 'STUDENT' || message.authorRole === 'TEACHER' ? 'bg-blue/5' : 'bg-lavender/40'}`}><div className="flex justify-between gap-3 text-xs text-muted"><span>{message.author?.name || message.authorRole}</span><span>{message.createdAt ? formatDate(message.createdAt, fa) : ''}</span></div><p className="mt-2 whitespace-pre-wrap leading-7">{message.body}</p></article>)}</div>
          {detail.data.status !== 'CLOSED' && <div className="mt-6"><textarea value={body} onChange={(event) => setBody(event.target.value)} className="min-h-28 w-full rounded-2xl border hairline p-4 outline-none focus:border-purple" placeholder={fa ? 'پاسخ خود را بنویسید…' : 'Write your reply…'} />{reply.isError && <p role="alert" className="mt-2 text-sm text-red-700">{apiMessage(reply.error, fa ? 'پاسخ ارسال نشد.' : 'Could not send the reply.')}</p>}<button disabled={!body.trim() || reply.isPending} onClick={() => reply.mutate()} className="brand-gradient mt-3 rounded-xl px-6 py-3 font-black text-white disabled:opacity-40">{reply.isPending ? (fa ? 'در حال ارسال…' : 'Sending…') : (fa ? 'ارسال پاسخ' : 'Send reply')}</button></div>}
        </div>}
      </div>
    </div>}
  </section>;
}

function Status({ value, fa }: { value: string; fa: boolean }) {
  const labels: Record<string, string> = { OPEN: 'باز', IN_PROGRESS: 'در حال رسیدگی', WAITING_USER: 'منتظر پاسخ شما', WAITING_SUPPORT: 'منتظر پشتیبانی', RESOLVED: 'حل‌شده', CLOSED: 'بسته' };
  return <span className="shrink-0 rounded-full bg-lavender px-3 py-1 text-xs font-black text-purple">{fa ? labels[value] ?? value : value.replaceAll('_', ' ')}</span>;
}
function formatDate(value: string, fa: boolean) {
  return new Intl.DateTimeFormat(fa ? 'fa-IR-u-ca-persian' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}
function ErrorBox({ message, retry }: { message: string; retry: () => void }) {
  return <div role="alert" className="rounded-2xl bg-red-50 p-4 text-red-800">{message} <button onClick={retry} className="font-bold underline">Retry</button></div>;
}
