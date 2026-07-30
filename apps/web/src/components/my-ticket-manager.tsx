'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiMessage } from '@/lib/api';
import { useTranslations } from './locale-provider';
import {Paperclip,Plus,Search,X} from 'lucide-react';

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
  const [search,setSearch]=useState('');
  const [status,setStatus]=useState('');
  const [creating,setCreating]=useState(false);
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
  const create=useMutation({mutationFn:(form:FormData)=>api('/support/tickets',{method:'POST',body:JSON.stringify({subject:String(form.get('subject')),category:String(form.get('category')),priority:String(form.get('priority')),body:String(form.get('body'))})}),onSuccess:async()=>{setCreating(false);await queryClient.invalidateQueries({queryKey:['my-tickets']})}});
  const visible=list.data?.items.filter(ticket=>(!status||ticket.status===status)&&(!search||ticket.subject.toLowerCase().includes(search.toLowerCase())))??[];

  return <section className="mt-7">
    <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><h1 className="text-2xl font-black">{fa ? 'پشتیبانی و تیکت‌ها' : 'Support tickets'}</h1><p className="mt-2 text-sm text-muted">درخواست‌های خود را ثبت کنید و پاسخ تیم پشتیبانی را دنبال کنید.</p></div>
      <button onClick={()=>setCreating(true)} className="primary-button"><Plus size={18}/>ایجاد تیکت جدید</button>
    </div>
    <div className="panel-card mb-4 grid gap-3 p-3 sm:grid-cols-[1fr_190px]"><label className="flex items-center gap-2 rounded-xl border hairline px-3"><Search size={17} className="text-muted"/><input value={search} onChange={e=>setSearch(e.target.value)} className="w-full bg-transparent py-3 outline-none" placeholder="جست‌وجوی عنوان تیکت…"/></label><select value={status} onChange={e=>setStatus(e.target.value)} className="input py-3"><option value="">همه وضعیت‌ها</option><option value="OPEN">باز</option><option value="IN_PROGRESS">در حال رسیدگی</option><option value="CLOSED">بسته</option></select></div>
    {list.isLoading && <div className="skeleton h-40 rounded-3xl" />}
    {list.isError && <ErrorBox message={apiMessage(list.error, fa ? 'تیکت‌های شما دریافت نشد.' : 'Could not load your tickets.')} retry={() => list.refetch()} />}
    {list.data && !list.data.items.length && <div className="rounded-3xl border border-dashed hairline p-10 text-center text-muted">{fa ? 'هنوز تیکتی ثبت نکرده‌اید.' : 'You have not created a ticket yet.'}</div>}
    {!!list.data?.items.length && <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
      <div className="grid content-start gap-3">{visible.map((ticket) =>
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
          {detail.data.status !== 'CLOSED' && <div className="mt-6"><textarea value={body} onChange={(event) => setBody(event.target.value)} className="min-h-28 w-full rounded-2xl border hairline p-4 outline-none focus:border-purple" placeholder={fa ? 'پاسخ خود را بنویسید…' : 'Write your reply…'} /><div className="mt-3 flex items-center justify-between gap-3"><button type="button" disabled title="ضمیمه پس از انتخاب فایل به attachmentId تبدیل می‌شود" className="secondary-button opacity-60"><Paperclip size={17}/>ضمیمه فایل</button>{reply.isError && <p role="alert" className="text-sm text-red-700">{apiMessage(reply.error, fa ? 'پاسخ ارسال نشد.' : 'Could not send the reply.')}</p>}<button disabled={!body.trim() || reply.isPending} onClick={() => reply.mutate()} className="primary-button disabled:opacity-40">{reply.isPending ? (fa ? 'در حال ارسال…' : 'Sending…') : (fa ? 'ارسال پاسخ' : 'Send reply')}</button></div></div>}
        </div>}
      </div>
    </div>}{creating&&<div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4" onMouseDown={()=>setCreating(false)}><form onSubmit={e=>{e.preventDefault();create.mutate(new FormData(e.currentTarget))}} onMouseDown={e=>e.stopPropagation()} className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl"><div className="flex items-center justify-between"><h2 className="text-xl font-black">ایجاد تیکت جدید</h2><button type="button" onClick={()=>setCreating(false)} aria-label="بستن"><X/></button></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="sm:col-span-2"><span className="mb-2 block text-sm font-bold">عنوان</span><input required minLength={3} maxLength={160} name="subject" className="input"/></label><label><span className="mb-2 block text-sm font-bold">دسته‌بندی</span><select name="category" className="input"><option value="general">عمومی</option><option value="class">کلاس</option><option value="payment">پرداخت</option><option value="technical">فنی</option></select></label><label><span className="mb-2 block text-sm font-bold">اولویت</span><select name="priority" className="input"><option value="normal">عادی</option><option value="high">زیاد</option><option value="urgent">فوری</option><option value="low">کم</option></select></label><label className="sm:col-span-2"><span className="mb-2 block text-sm font-bold">توضیحات</span><textarea required minLength={2} maxLength={5000} name="body" className="input min-h-32"/></label></div>{create.isError&&<p className="mt-3 text-sm text-red-600">{apiMessage(create.error,'تیکت ایجاد نشد.')}</p>}<div className="mt-5 flex justify-end gap-2"><button type="button" onClick={()=>setCreating(false)} className="secondary-button">انصراف</button><button disabled={create.isPending} className="primary-button">{create.isPending?'در حال ثبت…':'ثبت تیکت'}</button></div></form></div>}
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
