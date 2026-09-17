'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, FileText, ReceiptText, XCircle } from 'lucide-react';
import { api, apiMessage } from '@/shared/services/api';
import { localized } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';

export type ReceiptPayment = {
  id: string;
  amount: number;
  status: string;
  purpose: string;
  createdAt: string;
  reviewNote?: string | null;
  reviewedAt?: string | null;
  receiptFile?: { id: string; originalName: string; mimeType: string } | null;
  user?: { id?: string; name?: string; phone?: string };
  course?: { titleFa: string; titleEn: string } | null;
};

type Invoice = {
  id: string;
  purpose: string;
  amount: number;
  status: string;
  createdAt: string;
  gatewayReference?: string | null;
  receiptFileId?: string | null;
  reviewNote?: string | null;
};

const t = (fa: boolean, faText: string, enText: string) => localized({ fa: faText, en: enText }, fa);
const money = (value: number, fa: boolean) => formatMoney(value, fa ? 'fa' : 'en');
const date = (value: string, fa: boolean) =>
  new Intl.DateTimeFormat(fa ? 'fa-IR' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

function statusLabel(status: string, hasReceipt: boolean, fa: boolean) {
  if (status === 'PAID') return t(fa, 'پرداخت‌شده', 'Paid');
  if (hasReceipt && status === 'PENDING') return t(fa, 'در انتظار تأیید', 'Awaiting review');
  if (hasReceipt && status === 'FAILED') return t(fa, 'رد شده', 'Rejected');
  return status;
}

function purposeLabel(purpose: string, fa: boolean) {
  if (purpose === 'wallet_top_up') return t(fa, 'افزایش موجودی کیف پول', 'Wallet top-up');
  if (purpose === 'course') return t(fa, 'خرید دوره', 'Course purchase');
  if (purpose === 'package') return t(fa, 'خرید بسته', 'Package purchase');
  if (purpose === 'booking') return t(fa, 'پرداخت کلاس', 'Class payment');
  return purpose;
}

/** Opens the receipt through a short-lived signed URL; the API checks payments.read. */
export function ReceiptLink({ fileId, fa }: { fileId: string; fa: boolean }) {
  const open = useMutation({
    mutationFn: () => api<{ url: string }>(`/files/${fileId}/download`),
    onSuccess: ({ url }) => window.open(url, '_blank', 'noopener,noreferrer'),
  });
  return (
    <button
      type="button"
      onClick={() => open.mutate()}
      disabled={open.isPending}
      className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 underline disabled:opacity-50"
    >
      <FileText size={14} />
      {open.isError ? t(fa, 'باز نشد، دوباره', 'Failed, retry') : t(fa, 'مشاهده رسید', 'View receipt')}
    </button>
  );
}

/** Finance-center queue of card-to-card receipts awaiting approval. */
export function ReceiptReviewQueue({
  payments,
  fa,
  currentUserId,
}: {
  payments: ReceiptPayment[];
  fa: boolean;
  currentUserId?: string;
}) {
  const queryClient = useQueryClient();
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const pending = payments.filter((p) => p.receiptFile && p.status === 'PENDING' && !p.reviewedAt);
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['/admin/payments'] }),
      queryClient.invalidateQueries({ queryKey: ['/admin/reports'] }),
    ]);
  const approve = useMutation({
    mutationFn: (id: string) =>
      api(`/admin/payments/${id}/receipt/approve`, { method: 'POST', body: JSON.stringify({}) }),
    onSuccess: refresh,
  });
  const reject = useMutation({
    mutationFn: ({ id, why }: { id: string; why: string }) =>
      api(`/admin/payments/${id}/receipt/reject`, { method: 'POST', body: JSON.stringify({ reason: why }) }),
    onSuccess: async () => {
      setRejecting(null);
      setReason('');
      await refresh();
    },
  });
  const busy = approve.isPending || reject.isPending;
  const error = approve.error ?? reject.error;

  return (
    <section className="panel-card mt-5 overflow-hidden">
      <div className="border-b hairline p-5 text-end">
        <h2 className="text-xl font-black">
          {t(fa, 'رسیدهای پرداخت در انتظار تأیید', 'Payment receipts awaiting review')}
        </h2>
        <p className="mt-1 text-xs text-muted">
          {t(
            fa,
            'با تأیید، مبلغ به کیف پول کاربر اضافه یا کاربر در دوره ثبت‌نام می‌شود.',
            "Approving credits the user's wallet or enrolls them in the course.",
          )}
        </p>
      </div>
      {error && (
        <p role="alert" className="m-4 rounded-xl bg-red-50 p-3 text-xs text-red-700">
          {apiMessage(error, t(fa, 'عملیات انجام نشد.', 'Action failed.'))}
        </p>
      )}
      {pending.length === 0 ? (
        <div className="p-8 text-center">
          <ReceiptText className="mx-auto text-muted" />
          <p className="mt-3 text-sm font-bold">{t(fa, 'رسیدی در انتظار نیست.', 'No receipts waiting.')}</p>
        </div>
      ) : (
        <div className="grid divide-y hairline">
          {pending.map((item) => (
            <div key={item.id} className="grid gap-3 p-4 text-sm">
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-center">
                <span className="text-muted">{date(item.createdAt, fa)}</span>
                <span className="font-black">{money(item.amount, fa)}</span>
                <ReceiptLink fileId={item.receiptFile!.id} fa={fa} />
                <span className="text-end">
                  <strong className="block">{item.user?.name || item.user?.phone || t(fa, 'کاربر', 'User')}</strong>
                  <small className="block text-muted">
                    {item.course
                      ? `${t(fa, 'خرید دوره', 'Course')}: ${localized({ fa: item.course.titleFa, en: item.course.titleEn }, fa)}`
                      : purposeLabel(item.purpose, fa)}
                  </small>
                  {item.reviewNote && <small className="text-muted">{item.reviewNote}</small>}
                </span>
              </div>
              {currentUserId && item.user?.id === currentUserId ? (
                <p className="text-end text-xs text-amber-700">
                  {t(
                    fa,
                    'این رسید مال خودتان است و باید ادمین دیگری آن را بررسی کند.',
                    'This is your own receipt; another admin must review it.',
                  )}
                </p>
              ) : rejecting === item.id ? (
                <form
                  className="flex flex-wrap gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    reject.mutate({ id: item.id, why: reason.trim() });
                  }}
                >
                  <input
                    autoFocus
                    value={reason}
                    maxLength={500}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder={t(fa, 'دلیل رد رسید', 'Rejection reason')}
                    className="input min-w-0 flex-1"
                  />
                  <button
                    disabled={!reason.trim() || busy}
                    className="secondary-button text-red-700 disabled:opacity-50"
                  >
                    {t(fa, 'ثبت رد', 'Reject')}
                  </button>
                  <button type="button" onClick={() => setRejecting(null)} className="secondary-button">
                    {t(fa, 'انصراف', 'Cancel')}
                  </button>
                </form>
              ) : (
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setRejecting(item.id)}
                    className="secondary-button text-red-700 disabled:opacity-50"
                  >
                    <XCircle size={16} />
                    {t(fa, 'رد', 'Reject')}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      if (
                        window.confirm(
                          t(
                            fa,
                            `تأیید و شارژ ${money(item.amount, fa)}؟`,
                            `Approve and credit ${money(item.amount, fa)}?`,
                          ),
                        )
                      )
                        approve.mutate(item.id);
                    }}
                    className="primary-button disabled:opacity-50"
                  >
                    <CheckCircle2 size={16} />
                    {item.purpose === 'course'
                      ? t(fa, 'تأیید و ثبت‌نام در دوره', 'Approve & enroll')
                      : t(fa, 'تأیید و شارژ کیف پول', 'Approve & credit')}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/** A user's invoices (with receipts) inside the admin user-detail drawer. */
export function AdminUserInvoices({ userId, fa }: { userId: string; fa: boolean }) {
  const invoices = useQuery({
    queryKey: ['admin-user-invoices', userId],
    queryFn: () => api<Invoice[]>(`/admin/users/${userId}/invoices`),
  });
  return (
    <section className="panel-card mt-5 p-5">
      <h3 className="font-black">{t(fa, 'فاکتورها و رسیدها', 'Invoices and receipts')}</h3>
      {invoices.isLoading && <div className="skeleton mt-3 h-20 rounded-xl" />}
      {invoices.isError && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {apiMessage(invoices.error, t(fa, 'فاکتورها دریافت نشدند.', 'Could not load invoices.'))}
        </p>
      )}
      {invoices.data?.length === 0 && (
        <p className="mt-3 text-sm text-muted">{t(fa, 'فاکتوری وجود ندارد.', 'No invoices.')}</p>
      )}
      <div className="mt-3 divide-y hairline">
        {invoices.data?.map((row) => (
          <div key={row.id} className="flex items-center justify-between gap-3 py-3 text-sm">
            <div>
              <strong>{purposeLabel(row.purpose, fa)}</strong>
              <p className="mt-1 text-xs text-muted" dir="ltr">
                {row.gatewayReference ?? row.id}
              </p>
              <p className="text-xs text-muted">{date(row.createdAt, fa)}</p>
              {row.receiptFileId && <ReceiptLink fileId={row.receiptFileId} fa={fa} />}
              {row.status === 'FAILED' && row.receiptFileId && row.reviewNote && (
                <p className="text-xs text-red-700">{row.reviewNote}</p>
              )}
            </div>
            <div className="text-end">
              <p>{money(row.amount, fa)}</p>
              <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                {statusLabel(row.status, Boolean(row.receiptFileId), fa)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
