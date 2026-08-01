'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDownToLine,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  CreditCard,
  RefreshCw,
  Search,
  WalletCards,
} from 'lucide-react';
import { api, apiMessage } from '@/lib/api';
import { useTranslations } from './locale-provider';

type Aggregate = { status: string; _count: { _all: number }; _sum: Record<string, number | null> };
type Reports = {
  paymentsByStatus: Aggregate[];
  earningsByStatus: Aggregate[];
  payoutsByStatus: Aggregate[];
};
type Payment = {
  id: string;
  amount: number;
  status: string;
  purpose: string;
  gatewayAmount: number;
  walletAmount: number;
  createdAt: string;
  user?: { name?: string; phone?: string };
};
type Withdrawal = {
  id: string;
  amount: number;
  iban: string;
  status: string;
  reference?: string;
  createdAt: string;
  transferredAt?: string;
  teacher: { nameFa: string; nameEn: string; user?: { phone?: string } };
};

const sum = (rows: Aggregate[] | undefined, statuses: string[], field: string) =>
  (rows ?? [])
    .filter((row) => statuses.includes(row.status))
    .reduce((total, row) => total + Number(row._sum[field] ?? 0), 0);

export function AdminFinanceCenter() {
  const { locale } = useTranslations();
  const fa = locale === 'fa';
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Withdrawal | null>(null);
  const [reference, setReference] = useState('');

  const reports = useQuery({ queryKey: ['/admin/reports'], queryFn: () => api<Reports>('/admin/reports') });
  const payments = useQuery({ queryKey: ['/admin/payments'], queryFn: () => api<Payment[]>('/admin/payments') });
  const withdrawals = useQuery({ queryKey: ['/payouts/withdrawals'], queryFn: () => api<Withdrawal[]>('/payouts/withdrawals') });
  const transfer = useMutation({
    mutationFn: ({ id, bankReference }: { id: string; bankReference: string }) =>
      api(`/payouts/withdrawals/${id}/transfer`, {
        method: 'POST',
        body: JSON.stringify({ reference: bankReference }),
      }),
    onSuccess: async () => {
      setSelected(null);
      setReference('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['/payouts/withdrawals'] }),
        queryClient.invalidateQueries({ queryKey: ['/admin/reports'] }),
      ]);
    },
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (withdrawals.data ?? []).filter((item) => {
      const matchesStatus = status === 'ALL' || item.status === status;
      const haystack = [item.teacher.nameFa, item.teacher.nameEn, item.teacher.user?.phone, item.iban, item.reference]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return matchesStatus && (!term || haystack.includes(term));
    });
  }, [search, status, withdrawals.data]);

  const pendingWithdrawals = (withdrawals.data ?? []).filter((item) => ['PENDING', 'APPROVED'].includes(item.status));
  const paidRevenue = sum(reports.data?.paymentsByStatus, ['PAID', 'PARTIALLY_REFUNDED'], 'amount');
  const payableEarnings = sum(reports.data?.earningsByStatus, ['PENDING', 'ELIGIBLE'], 'netAmount');
  const transferred = sum(reports.data?.payoutsByStatus, ['TRANSFERRED'], 'totalAmount');
  const pendingAmount = pendingWithdrawals.reduce((total, item) => total + item.amount, 0);
  const loading = reports.isLoading || payments.isLoading || withdrawals.isLoading;
  const hasError = reports.isError || payments.isError || withdrawals.isError;
  const refresh = () => Promise.all([reports.refetch(), payments.refetch(), withdrawals.refetch()]);

  const money = (value: number) =>
    fa ? `${value.toLocaleString('fa-IR')} تومان` : `${value.toLocaleString('en-US')} IRR`;
  const date = (value: string) =>
    new Intl.DateTimeFormat(fa ? 'fa-IR' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

  return (
    <div className="admin-finance">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <button type="button" onClick={refresh} disabled={loading} className="secondary-button self-start">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          {fa ? 'به‌روزرسانی' : 'Refresh'}
        </button>
        <div className="text-end">
          <p className="text-xs font-bold text-blue">{fa ? 'عملیات مالی' : 'Finance operations'}</p>
          <h1 className="mt-2 text-3xl font-black">{fa ? 'مالی و تسویه' : 'Finance & payouts'}</h1>
          <p className="mt-2 text-sm text-muted">
            {fa ? 'ورودی پول، بدهی مدرس‌ها و انتقال‌های بانکی در یک نمای قابل پیگیری' : 'Payments, teacher liabilities, and bank transfers in one traceable view'}
          </p>
        </div>
      </header>

      {hasError && (
        <div role="alert" className="mt-5 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          {fa ? 'دریافت بخشی از اطلاعات مالی ناموفق بود. مجوزها و اتصال API را بررسی کنید.' : 'Some finance data could not be loaded. Check permissions and the API connection.'}
        </div>
      )}

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <FinanceMetric icon={CircleDollarSign} label={fa ? 'درآمد وصول‌شده' : 'Collected revenue'} value={money(paidRevenue)} tone="emerald" loading={loading} />
        <FinanceMetric icon={WalletCards} label={fa ? 'بدهی قابل تسویه' : 'Payable earnings'} value={money(payableEarnings)} tone="blue" loading={loading} />
        <FinanceMetric icon={Clock3} label={fa ? 'برداشت در انتظار' : 'Pending withdrawals'} value={money(pendingAmount)} detail={fa ? `${pendingWithdrawals.length.toLocaleString('fa-IR')} درخواست` : `${pendingWithdrawals.length} requests`} tone="amber" loading={loading} />
        <FinanceMetric icon={CheckCircle2} label={fa ? 'انتقال بانکی‌شده' : 'Bank transferred'} value={money(transferred)} tone="purple" loading={loading} />
      </section>

      <section className="panel-card mt-5 overflow-hidden">
        <div className="flex flex-col gap-4 border-b hairline p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {['ALL', 'PENDING', 'APPROVED', 'TRANSFERRED'].map((item) => (
              <button
                type="button"
                key={item}
                onClick={() => setStatus(item)}
                className={`rounded-xl px-3 py-2 text-xs font-bold ${status === item ? 'bg-navy text-white' : 'bg-[#f5f7fb] text-muted'}`}
              >
                {statusLabel(item, fa)}
                {item === 'PENDING' && pendingWithdrawals.length > 0 && (
                  <span className="ms-2 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] text-white">{pendingWithdrawals.length.toLocaleString(fa ? 'fa-IR' : 'en-US')}</span>
                )}
              </button>
            ))}
          </div>
          <div className="text-end">
            <h2 className="text-xl font-black">{fa ? 'درخواست‌های برداشت مدرس‌ها' : 'Teacher withdrawal requests'}</h2>
            <p className="mt-1 text-xs text-muted">{fa ? 'انتقال فقط با ثبت شماره پیگیری بانکی نهایی می‌شود.' : 'A bank reference is required to complete a transfer.'}</p>
          </div>
        </div>
        <div className="border-b hairline p-4">
          <label className="flex items-center gap-2 rounded-xl border hairline bg-[#fafbfe] px-4 py-2.5 text-muted">
            <Search size={17} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full bg-transparent text-sm text-navy outline-none"
              placeholder={fa ? 'جستجو نام مدرس، موبایل، شبا یا شماره پیگیری…' : 'Search teacher, phone, IBAN, or reference…'}
            />
          </label>
        </div>

        {withdrawals.isLoading ? (
          <div className="p-8"><div className="skeleton h-52 rounded-2xl" /></div>
        ) : filtered.length ? (
          <div className="overflow-x-auto">
            <table className="finance-table">
              <thead><tr>
                <th>{fa ? 'مدرس' : 'Teacher'}</th>
                <th>{fa ? 'مبلغ' : 'Amount'}</th>
                <th>{fa ? 'شبا' : 'IBAN'}</th>
                <th>{fa ? 'درخواست' : 'Requested'}</th>
                <th>{fa ? 'وضعیت' : 'Status'}</th>
                <th>{fa ? 'عملیات' : 'Action'}</th>
              </tr></thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id}>
                    <td><strong className="block">{fa ? item.teacher.nameFa : item.teacher.nameEn}</strong><small className="mt-1 block text-muted latin">{item.teacher.user?.phone || '—'}</small></td>
                    <td className="font-black">{money(item.amount)}</td>
                    <td className="latin text-xs">{maskIban(item.iban)}</td>
                    <td className="whitespace-nowrap text-xs text-muted">{date(item.createdAt)}</td>
                    <td><WithdrawalStatus status={item.status} fa={fa} /></td>
                    <td>
                      {['PENDING', 'APPROVED'].includes(item.status) ? (
                        <button type="button" onClick={() => { setSelected(item); setReference(''); transfer.reset(); }} className="primary-button !px-3 !py-2 text-xs">
                          <ArrowDownToLine size={15} />{fa ? 'ثبت انتقال' : 'Transfer'}
                        </button>
                      ) : <span className="latin text-xs text-muted">{item.reference || '—'}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center"><CreditCard className="mx-auto text-[#c4cada]" /><p className="mt-3 text-sm font-bold">{fa ? 'درخواستی با این فیلتر پیدا نشد.' : 'No requests match these filters.'}</p></div>
        )}
      </section>

      <section className="panel-card mt-5 overflow-hidden">
        <div className="border-b hairline p-5 text-end">
          <h2 className="text-xl font-black">{fa ? 'آخرین پرداخت‌های کاربران' : 'Recent customer payments'}</h2>
          <p className="mt-1 text-xs text-muted">{fa ? 'برای بازپرداخت و جزئیات بیشتر وارد بخش پرداخت‌ها شوید.' : 'Open Payments for refunds and full details.'}</p>
        </div>
        <div className="grid divide-y hairline">
          {(payments.data ?? []).slice(0, 6).map((item) => (
            <div key={item.id} className="grid gap-3 p-4 text-sm sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-center">
              <span className="text-muted">{date(item.createdAt)}</span>
              <PaymentStatus status={item.status} fa={fa} />
              <span className="font-black">{money(item.amount)}</span>
              <span className="text-end"><strong className="block">{item.user?.name || item.user?.phone || (fa ? 'کاربر' : 'User')}</strong><small className="text-muted">{item.purpose}</small></span>
            </div>
          ))}
        </div>
      </section>

      {selected && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-navy/35 p-4 backdrop-blur-sm" onMouseDown={() => setSelected(null)}>
          <form
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              if (reference.trim()) transfer.mutate({ id: selected.id, bankReference: reference.trim() });
            }}
          >
            <p className="text-xs font-bold text-blue">{fa ? 'تأیید انتقال بانکی' : 'Confirm bank transfer'}</p>
            <h2 className="mt-2 text-2xl font-black">{money(selected.amount)}</h2>
            <div className="mt-5 rounded-2xl bg-[#f7f8fc] p-4 text-sm">
              <p className="font-bold">{fa ? selected.teacher.nameFa : selected.teacher.nameEn}</p>
              <p className="latin mt-2 text-muted">{selected.iban}</p>
            </div>
            <label className="mt-5 block">
              <span className="mb-2 block text-sm font-bold">{fa ? 'شماره پیگیری بانکی' : 'Bank reference'}</span>
              <input value={reference} onChange={(event) => setReference(event.target.value)} required dir="ltr" className="input latin" placeholder="مثلاً 847291035" />
            </label>
            <p className="mt-3 text-xs leading-6 text-muted">{fa ? 'پس از تأیید، مبلغ از کیف پول مدرس کسر و درخواست نهایی می‌شود.' : 'After confirmation, the amount is debited from the teacher wallet and the request is finalized.'}</p>
            {transfer.isError && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-xs text-red-700">{apiMessage(transfer.error, fa ? 'ثبت انتقال ناموفق بود.' : 'Transfer failed.')}</p>}
            <div className="mt-5 flex gap-3">
              <button type="button" onClick={() => setSelected(null)} className="secondary-button flex-1 justify-center">{fa ? 'انصراف' : 'Cancel'}</button>
              <button disabled={!reference.trim() || transfer.isPending} className="primary-button flex-1 justify-center disabled:opacity-50">{transfer.isPending ? (fa ? 'در حال ثبت…' : 'Saving…') : (fa ? 'تأیید انتقال' : 'Confirm')}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function FinanceMetric({ icon: Icon, label, value, detail, tone, loading }: { icon: React.ElementType; label: string; value: string; detail?: string; tone: 'emerald' | 'blue' | 'amber' | 'purple'; loading: boolean }) {
  const colors = { emerald: 'bg-emerald-50 text-emerald-700', blue: 'bg-blue/10 text-blue', amber: 'bg-amber-50 text-amber-700', purple: 'bg-violet-50 text-violet-700' };
  return <article className="panel-card p-5"><div className="flex items-start justify-between gap-3"><span className={`grid size-10 place-items-center rounded-xl ${colors[tone]}`}><Icon size={19} /></span><div className="text-end"><p className="text-xs text-muted">{label}</p><strong className="mt-2 block text-lg font-black">{loading ? '—' : value}</strong>{detail && <small className="mt-2 block text-muted">{detail}</small>}</div></div></article>;
}

function WithdrawalStatus({ status, fa }: { status: string; fa: boolean }) {
  const map: Record<string, [string, string]> = { PENDING: ['در انتظار', 'status-warning'], APPROVED: ['تأییدشده', 'status-info'], TRANSFERRED: ['واریزشده', 'status-success'], REJECTED: ['ردشده', 'bg-red-50 text-red-700'] };
  const item = map[status] ?? [status, 'status-info'];
  return <span className={`status-pill ${item[1]}`}>{fa ? item[0] : status.toLowerCase().replaceAll('_', ' ')}</span>;
}

function PaymentStatus({ status, fa }: { status: string; fa: boolean }) {
  const success = ['PAID', 'PARTIALLY_REFUNDED'].includes(status);
  return <span className={`status-pill ${success ? 'status-success' : status === 'PENDING' ? 'status-warning' : 'bg-red-50 text-red-700'}`}>{fa ? ({ PAID: 'پرداخت‌شده', PENDING: 'در انتظار', FAILED: 'ناموفق', REFUNDED: 'بازپرداخت‌شده', PARTIALLY_REFUNDED: 'بازپرداخت جزئی' }[status] ?? status) : status.toLowerCase().replaceAll('_', ' ')}</span>;
}

function statusLabel(status: string, fa: boolean) {
  if (!fa) return status === 'ALL' ? 'All' : status.toLowerCase().replaceAll('_', ' ');
  return ({ ALL: 'همه', PENDING: 'در انتظار', APPROVED: 'تأییدشده', TRANSFERRED: 'واریزشده' } as Record<string, string>)[status] ?? status;
}

function maskIban(iban: string) {
  const clean = iban.replace(/\s/g, '');
  return clean.length > 10 ? `${clean.slice(0, 6)}••••••••${clean.slice(-4)}` : clean;
}
