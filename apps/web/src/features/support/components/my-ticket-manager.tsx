'use client';

import { localized, isDefaultLocale, translate } from '@/lib/i18n';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiMessage } from '@/shared/services/api';
import { useTranslations } from '@/components/shared/locale-provider';
import { CalendarDays, ChevronDown, LoaderCircle, Paperclip, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import { uploadErrorMessage } from '@/shared/services/upload';
import {
  SUPPORT_ATTACHMENT_MAX_BYTES,
  SUPPORT_ATTACHMENT_TYPES,
  uploadSupportAttachment,
} from '../services/upload-support-attachment';

type Ticket = {
  id: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  createdAt?: string;
  updatedAt: string;
  replies: {
    id?: string;
    body: string;
    attachmentId?: string;
    createdAt?: string;
    authorRole?: string;
    author?: { name?: string };
  }[];
};
type TicketPage = { items: Ticket[]; pagination: { total: number; pages: number } };
type CreateErrors = { subject?: string; body?: string; attachment?: string };

export function MyTicketManager() {
  const { locale } = useTranslations();
  const fa = isDefaultLocale(locale);
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string>();
  const [body, setBody] = useState('');
  const [replyFile, setReplyFile] = useState<File>();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [creating, setCreating] = useState(false);
  const [createFile, setCreateFile] = useState<File>();
  const [createErrors, setCreateErrors] = useState<CreateErrors>({});
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const list = useQuery({ queryKey: ['my-tickets'], queryFn: () => api<TicketPage>('/support/tickets?pageSize=100') });
  const detail = useQuery({
    queryKey: ['my-ticket', selectedId],
    queryFn: () => api<Ticket>(`/support/tickets/${selectedId}`),
    enabled: !!selectedId,
  });
  const reply = useMutation({
    mutationFn: async () => {
      const attachmentId = replyFile ? await uploadSupportAttachment(replyFile, fa) : undefined;
      return api(`/support/tickets/${selectedId}/replies`, {
        method: 'POST',
        body: JSON.stringify({ body, attachmentId }),
      });
    },
    onSuccess: async () => {
      setBody('');
      setReplyFile(undefined);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['my-tickets'] }),
        queryClient.invalidateQueries({ queryKey: ['my-ticket', selectedId] }),
      ]);
    },
  });
  const create = useMutation({
    mutationFn: async (form: FormData) => {
      const file = form.get('attachment');
      const attachmentId = file instanceof File && file.size ? await uploadSupportAttachment(file, fa) : undefined;
      return api('/support/tickets', {
        method: 'POST',
        body: JSON.stringify({
          subject: String(form.get('subject')),
          category: String(form.get('category')),
          priority: String(form.get('priority')),
          body: String(form.get('body')),
          attachmentId,
        }),
      });
    },
    onSuccess: async () => {
      setCreating(false);
      setCreateFile(undefined);
      setCreateErrors({});
      await queryClient.invalidateQueries({ queryKey: ['my-tickets'] });
    },
  });
  useEffect(() => {
    if (!creating) return;
    subjectRef.current?.focus();
    const body = document.body;
    const previousOverflow = body.style.overflow;
    const previousPaddingInlineEnd = body.style.paddingInlineEnd;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    const currentPaddingInlineEnd = Number.parseFloat(window.getComputedStyle(body).paddingInlineEnd) || 0;
    body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) body.style.paddingInlineEnd = `${currentPaddingInlineEnd + scrollbarWidth}px`;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !create.isPending) setCreating(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      body.style.overflow = previousOverflow;
      body.style.paddingInlineEnd = previousPaddingInlineEnd;
    };
  }, [creating, create.isPending]);

  const closeCreateModal = () => {
    if (create.isPending) return;
    setCreating(false);
    setCreateFile(undefined);
    setCreateErrors({});
    create.reset();
  };

  const submitTicket = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const subject = String(form.get('subject')).trim();
    const description = String(form.get('body')).trim();
    const errors: CreateErrors = {};
    if (!subject) errors.subject = 'عنوان تیکت را وارد کنید.';
    else if (subject.length < 3) errors.subject = 'عنوان تیکت باید حداقل ۳ کاراکتر باشد.';
    if (!description) errors.body = 'توضیحات تیکت را وارد کنید.';
    else if (description.length < 2) errors.body = 'توضیحات تیکت باید حداقل ۲ کاراکتر باشد.';
    if (createFile && !SUPPORT_ATTACHMENT_TYPES.includes(createFile.type))
      errors.attachment = 'فقط فایل‌های PDF، JPG و PNG مجاز هستند.';
    else if (createFile && createFile.size > SUPPORT_ATTACHMENT_MAX_BYTES)
      errors.attachment = 'حجم فایل نباید بیشتر از ۱۰ مگابایت باشد.';
    setCreateErrors(errors);
    if (errors.subject) subjectRef.current?.focus();
    else if (errors.body) bodyRef.current?.focus();
    if (Object.keys(errors).length) return;
    create.mutate(form);
  };
  const visible =
    list.data?.items.filter(
      (ticket) =>
        (!status || ticket.status === status) &&
        (!search || ticket.subject.toLowerCase().includes(search.toLowerCase())),
    ) ?? [];

  return (
    <section className="mt-7" dir={translate(locale, 'supportmyTicketManagerLtr')}>
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-black">{translate(locale, 'supportmyTicketManagerSupportTickets')}</h1>
          <p className="mt-2 text-sm text-muted">درخواست‌های خود را ثبت کنید و پاسخ تیم پشتیبانی را دنبال کنید.</p>
        </div>
        <button onClick={() => setCreating(true)} className="primary-button min-h-11 justify-center shadow-sm">
          <Plus size={18} />
          ایجاد تیکت جدید
        </button>
      </div>
      <div className="panel-card mb-5 grid gap-3 p-3 sm:grid-cols-[1fr_190px]">
        <label className="flex min-h-11 items-center gap-2 rounded-xl border hairline bg-white px-3 transition focus-within:border-purple focus-within:ring-4 focus-within:ring-purple/10">
          <Search size={17} className="text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent py-3 outline-none"
            placeholder="جست‌وجوی عنوان تیکت…"
          />
        </label>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="input min-h-11 py-2.5">
          <option value="">همه وضعیت‌ها</option>
          <option value="OPEN">باز</option>
          <option value="IN_PROGRESS">در حال رسیدگی</option>
          <option value="CLOSED">بسته</option>
        </select>
      </div>
      {list.isLoading && <div className="skeleton h-40 rounded-3xl" />}
      {list.isError && (
        <ErrorBox
          message={apiMessage(list.error, translate(locale, 'supportmyTicketManagerCouldNotLoadYourTickets'))}
          retry={() => list.refetch()}
        />
      )}
      {list.data && !list.data.items.length && (
        <div className="rounded-3xl border border-dashed hairline p-10 text-center text-muted">
          {translate(locale, 'supportmyTicketManagerYouHaveNotCreatedATicketYet')}
        </div>
      )}
      {!!list.data?.items.length && (
        <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="grid content-start gap-3">
            {visible.map((ticket) => (
              <button
                key={ticket.id}
                onClick={() => setSelectedId(ticket.id)}
                className={`group rounded-2xl border p-4 text-start transition hover:-translate-y-0.5 hover:border-purple/40 hover:shadow-soft ${selectedId === ticket.id ? 'border-purple bg-lavender/40 shadow-sm' : 'hairline bg-white'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <strong>{ticket.subject}</strong>
                  <Status value={ticket.status} fa={fa} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-medium text-muted">
                  <span className="rounded-md bg-slate-100 px-2 py-1">{categoryLabel(ticket.category, fa)}</span>
                  <span className={priorityClass(ticket.priority)}>{priorityLabel(ticket.priority, fa)}</span>
                  <span className="ms-auto inline-flex items-center gap-1">
                    <CalendarDays size={13} />
                    {formatDate(ticket.updatedAt, fa)}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-sm">{ticket.replies[0]?.body}</p>
              </button>
            ))}
          </div>
          <div className="rounded-3xl border hairline bg-white p-5">
            {!selectedId && (
              <p className="py-16 text-center text-muted">
                {translate(locale, 'supportmyTicketManagerSelectATicketToViewTheConversation')}
              </p>
            )}
            {detail.isLoading && <div className="skeleton h-64 rounded-2xl" />}
            {detail.isError && (
              <ErrorBox
                message={apiMessage(detail.error, translate(locale, 'supportmyTicketManagerCouldNotLoadTicketDetails'))}
                retry={() => detail.refetch()}
              />
            )}
            {detail.data && (
              <div>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted">{detail.data.category}</p>
                    <h3 className="mt-1 text-xl font-black">{detail.data.subject}</h3>
                  </div>
                  <Status value={detail.data.status} fa={fa} />
                </div>
                <div className="mt-6 grid gap-3">
                  {detail.data.replies.map((message, index) => (
                    <article
                      key={message.id ?? index}
                      className={`rounded-2xl p-4 ${message.authorRole === 'STUDENT' || message.authorRole === 'INSTRUCTOR' ? 'bg-blue/5' : 'bg-lavender/40'}`}
                    >
                      <div className="flex justify-between gap-3 text-xs text-muted">
                        <span>{message.author?.name || message.authorRole}</span>
                        <span>{message.createdAt ? formatDate(message.createdAt, fa) : ''}</span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap leading-7">{message.body}</p>
                      {message.attachmentId && <AttachmentLink fileId={message.attachmentId} fa={fa} />}
                    </article>
                  ))}
                </div>
                {detail.data.status !== 'CLOSED' && (
                  <div className="mt-6">
                    <textarea
                      value={body}
                      onChange={(event) => setBody(event.target.value)}
                      className="min-h-28 w-full rounded-2xl border hairline p-4 outline-none focus:border-purple"
                      placeholder={translate(locale, 'supportmyTicketManagerWriteYourReply')}
                    />
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <label className="secondary-button cursor-pointer">
                        <Paperclip size={17} />
                        {replyFile ? replyFile.name : translate(locale, 'supportmyTicketManagerAttachFile')}
                        <input
                          type="file"
                          accept={SUPPORT_ATTACHMENT_TYPES.join(',')}
                          className="sr-only"
                          onChange={(event) => setReplyFile(event.target.files?.[0])}
                        />
                      </label>
                      {reply.isError && (
                        <p role="alert" className="text-sm text-red-700">
                          {uploadErrorMessage(reply.error, translate(locale, 'supportmyTicketManagerCouldNotSendTheReply'))}
                        </p>
                      )}
                      <button
                        disabled={!body.trim() || reply.isPending}
                        onClick={() => reply.mutate()}
                        className="primary-button disabled:opacity-40"
                      >
                        {reply.isPending
                          ? translate(locale, 'supportmyTicketManagerSending')
                          : translate(locale, 'supportmyTicketManagerSendReply')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      {creating && (
        <div
          className="fixed inset-0 z-50 grid place-items-center overflow-hidden bg-slate-950/45 p-4 backdrop-blur-[2px]"
          onMouseDown={closeCreateModal}
          role="presentation"
        >
          <form
            noValidate
            onSubmit={submitTicket}
            onMouseDown={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-ticket-title"
            className="flex max-h-[calc(100vh-32px)] max-h-[calc(100dvh-32px)] w-full max-w-[560px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,.22)]"
          >
            <div className="h-1 shrink-0 bg-gradient-to-l from-purple via-blue to-violet" />
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h2 id="create-ticket-title" className="text-xl font-bold text-slate-900">
                  ایجاد تیکت جدید
                </h2>
                <p className="mt-1 text-xs text-muted">
                  درخواستتان را بنویسید؛ تیم پشتیبانی پاسخ را همین‌جا ارسال می‌کند.
                </p>
              </div>
              <button
                type="button"
                onClick={closeCreateModal}
                aria-label="بستن پنجره ایجاد تیکت"
                className="grid size-10 shrink-0 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                <X size={20} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5 [scrollbar-gutter:stable]">
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="sm:col-span-2">
                  <span className="mb-2 block text-sm font-semibold text-slate-900">عنوان تیکت</span>
                  <input
                    ref={subjectRef}
                    minLength={3}
                    maxLength={160}
                    name="subject"
                    aria-invalid={!!createErrors.subject}
                    aria-describedby={createErrors.subject ? 'subject-error' : undefined}
                    onChange={() =>
                      createErrors.subject && setCreateErrors((value) => ({ ...value, subject: undefined }))
                    }
                    className={`input h-12 rounded-xl px-3.5 py-2.5 placeholder:text-slate-400 ${createErrors.subject ? 'border-red-400 ring-4 ring-red-50 focus:border-red-500 focus:shadow-none' : ''}`}
                    placeholder="موضوع درخواست خود را کوتاه بنویسید"
                  />
                  <FieldError id="subject-error" message={createErrors.subject} />
                </label>
                <div className="sm:col-span-2">
                  <span className="mb-2 block text-sm font-semibold text-slate-900">
                    ضمیمه <span className="font-normal text-muted">(اختیاری)</span>
                  </span>
                  <div
                    className={`relative flex min-h-[76px] items-center gap-3 rounded-xl border border-dashed px-4 py-3 transition hover:border-purple hover:bg-lavender/20 ${createErrors.attachment ? 'border-red-400 bg-red-50/50' : 'border-slate-300'}`}
                  >
                    <label htmlFor="ticket-attachment" className="absolute inset-0 cursor-pointer rounded-xl">
                      <span className="sr-only">انتخاب فایل ضمیمه</span>
                    </label>
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-lavender text-purple">
                      <Upload size={19} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-800">
                        {createFile?.name || 'انتخاب فایل'}
                      </span>
                      <span className="mt-1 block text-xs text-muted">PNG، JPG یا PDF تا حداکثر ۱۰ مگابایت</span>
                    </span>
                    {createFile && (
                      <button
                        type="button"
                        aria-label="حذف فایل انتخاب‌شده"
                        onClick={() => {
                          setCreateFile(undefined);
                          setCreateErrors((value) => ({ ...value, attachment: undefined }));
                          if (fileRef.current) fileRef.current.value = '';
                        }}
                        className="relative z-10 grid size-9 place-items-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 size={17} />
                      </button>
                    )}
                  </div>
                  <input
                    ref={fileRef}
                    id="ticket-attachment"
                    type="file"
                    name="attachment"
                    accept={SUPPORT_ATTACHMENT_TYPES.join(',')}
                    className="sr-only"
                    onChange={(event) => {
                      setCreateFile(event.target.files?.[0]);
                      setCreateErrors((value) => ({ ...value, attachment: undefined }));
                    }}
                  />
                  <FieldError id="attachment-error" message={createErrors.attachment} />
                </div>
                <label>
                  <span className="mb-2 block text-sm font-semibold text-slate-900">دسته‌بندی</span>
                  <span className="relative block">
                    <select name="category" className="input h-12 appearance-none rounded-xl px-3.5 py-2.5 ps-10">
                      <option value="general">عمومی</option>
                      <option value="class">کلاس</option>
                      <option value="payment">پرداخت</option>
                      <option value="technical">فنی</option>
                    </select>
                    <ChevronDown
                      size={17}
                      className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-muted"
                    />
                  </span>
                </label>
                <label>
                  <span className="mb-2 block text-sm font-semibold text-slate-900">اولویت</span>
                  <span className="relative block">
                    <select name="priority" className="input h-12 appearance-none rounded-xl px-3.5 py-2.5 ps-10">
                      <option value="normal">عادی</option>
                      <option value="high">زیاد</option>
                      <option value="urgent">فوری</option>
                      <option value="low">کم</option>
                    </select>
                    <ChevronDown
                      size={17}
                      className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-muted"
                    />
                  </span>
                </label>
                <label className="sm:col-span-2">
                  <span className="mb-2 block text-sm font-semibold text-slate-900">توضیحات</span>
                  <textarea
                    ref={bodyRef}
                    minLength={2}
                    maxLength={5000}
                    name="body"
                    aria-invalid={!!createErrors.body}
                    aria-describedby={createErrors.body ? 'body-error' : undefined}
                    onChange={() => createErrors.body && setCreateErrors((value) => ({ ...value, body: undefined }))}
                    className={`input min-h-[120px] resize-y rounded-xl px-3.5 py-3 leading-7 placeholder:text-slate-400 ${createErrors.body ? 'border-red-400 ring-4 ring-red-50 focus:border-red-500 focus:shadow-none' : ''}`}
                    placeholder="مشکل یا درخواست خود را با جزئیات توضیح دهید…"
                  />
                  <FieldError id="body-error" message={createErrors.body} />
                </label>
                {create.isError && (
                  <p role="alert" className="sm:col-span-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
                    {uploadErrorMessage(create.error, 'تیکت ایجاد نشد. دوباره تلاش کنید.')}
                  </p>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/70 px-6 py-4">
              <button
                type="button"
                onClick={closeCreateModal}
                disabled={create.isPending}
                className="secondary-button min-h-[44px] rounded-xl disabled:cursor-not-allowed disabled:opacity-50"
              >
                انصراف
              </button>
              <button
                disabled={create.isPending}
                className="primary-button min-h-[44px] min-w-28 justify-center rounded-xl disabled:cursor-not-allowed disabled:opacity-60"
              >
                {create.isPending && <LoaderCircle size={17} className="animate-spin" />}
                {create.isPending ? 'در حال ثبت…' : 'ثبت تیکت'}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return (
    <p id={id} role={message ? 'alert' : undefined} className="mt-1.5 min-h-[18px] text-xs text-red-600">
      {message}
    </p>
  );
}

function categoryLabel(value: string, fa: boolean) {
  const labels: Record<string, string> = { general: 'عمومی', class: 'کلاس', payment: 'پرداخت', technical: 'فنی' };
  return localized({ fa: labels[value] ?? value, en: value }, fa);
}

function priorityLabel(value: string, fa: boolean) {
  const labels: Record<string, string> = { low: 'کم', normal: 'عادی', high: 'زیاد', urgent: 'فوری' };
  return localized({ fa: labels[value] ?? value, en: value }, fa);
}

function priorityClass(value: string) {
  const tone =
    value === 'urgent'
      ? 'bg-red-50 text-red-700'
      : value === 'high'
        ? 'bg-amber-50 text-amber-700'
        : 'bg-slate-100 text-slate-600';
  return `rounded-md px-2 py-1 ${tone}`;
}

function AttachmentLink({ fileId, fa }: { fileId: string; fa: boolean }) {
  const download = useMutation({
    mutationFn: () => api<{ url: string }>(`/files/${fileId}/download`),
    onSuccess: ({ url }) => window.open(url, '_blank', 'noopener,noreferrer'),
  });
  return (
    <button
      type="button"
      onClick={() => download.mutate()}
      disabled={download.isPending}
      className="mt-3 flex items-center gap-2 text-sm font-bold text-purple underline disabled:opacity-50"
    >
      <Paperclip size={15} />
      {download.isPending
        ? translate(fa, 'supportmyTicketManagerDownloading')
        : translate(fa, 'supportmyTicketManagerViewAttachment')}
    </button>
  );
}

function Status({ value, fa }: { value: string; fa: boolean }) {
  const labels: Record<string, string> = {
    OPEN: 'باز',
    IN_PROGRESS: 'در حال رسیدگی',
    WAITING_USER: 'منتظر پاسخ شما',
    WAITING_SUPPORT: 'منتظر پشتیبانی',
    RESOLVED: 'حل‌شده',
    CLOSED: 'بسته',
  };
  return (
    <span className="shrink-0 rounded-full bg-lavender px-3 py-1 text-xs font-black text-purple">
      {localized({ fa: labels[value] ?? value, en: value.replaceAll('_', ' ') }, fa)}
    </span>
  );
}
function formatDate(value: string, fa: boolean) {
  return new Intl.DateTimeFormat(translate(fa, 'commercepricingManagerEnUS'), {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
function ErrorBox({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div role="alert" className="rounded-2xl bg-red-50 p-4 text-red-800">
      {message}{' '}
      <button onClick={retry} className="font-bold underline">
        Retry
      </button>
    </div>
  );
}
