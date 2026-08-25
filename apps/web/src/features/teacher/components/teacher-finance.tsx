'use client';

import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDownToLine, CircleDollarSign, Clock3, ReceiptText, ShieldCheck, WalletCards } from 'lucide-react';
import { api, apiField, apiMessage } from '@/lib/api';
import { useTranslations } from '@/components/shared/locale-provider';

type Earning = {
  id: string;
  netAmount: number;
  grossAmount: number;
  commissionAmount: number;
  status: string;
  createdAt: string;
  eligibleAt: string;
};
type Withdrawal = { id: string; amount: number; iban: string; status: string; reference?: string; createdAt: string };
type Finance = {
  earnings: Earning[];
  withdrawals: Withdrawal[];
  totals: { status: string; _sum: { netAmount: number | null } }[];
  walletBalance: number;
  reservedAmount: number;
  availableToWithdraw: number;
};

export function TeacherFinance() {
  const { locale } = useTranslations(),
    fa = locale === 'fa',
    qc = useQueryClient(),
    [amount, setAmount] = useState(''),
    [iban, setIban] = useState('');
  const query = useQuery({ queryKey: ['/teacher/finance'], queryFn: () => api<Finance>('/teacher/finance') });
  const withdrawalKey = useRef(crypto.randomUUID());
  const withdraw = useMutation({
    mutationFn: () =>
      api('/teacher/finance/withdrawals', {
        method: 'POST',
        body: JSON.stringify({
          amount: Number(amount),
          iban: iban.replace(/\s/g, '').toUpperCase(),
          idempotencyKey: withdrawalKey.current,
        }),
      }),
    onSuccess: async () => {
      setAmount('');
      withdrawalKey.current = crypto.randomUUID();
      await qc.invalidateQueries({ queryKey: ['/teacher/finance'] });
    },
  });
  if (query.isLoading)
    return (
      <div className="grid gap-4">
        <div className="skeleton h-52 rounded-3xl" />
        <div className="skeleton h-72 rounded-3xl" />
      </div>
    );
  if (query.isError)
    return (
      <div role="alert" className="panel-card p-8 text-red-700">
        {fa ? 'اطلاعات کیف پول دریافت نشد.' : 'Could not load wallet data.'}
      </div>
    );
  const data = query.data!,
    paid = data.totals.find((x) => x.status === 'PAID')?._sum.netAmount ?? 0,
    lifetime = data.totals.reduce((sum, x) => sum + (x._sum.netAmount ?? 0), 0);
  const money = (value: number) =>
      `${new Intl.NumberFormat(fa ? 'fa-IR' : 'en-US').format(value)} ${fa ? 'تومان' : 'IRR'}`,
    date = (value: string) =>
      new Intl.DateTimeFormat(fa ? 'fa-IR' : 'en-US', { dateStyle: 'medium' }).format(new Date(value));
  const validIban = /^IR\d{24}$/.test(iban.replace(/\s/g, '').toUpperCase()),
    numericAmount = Number(amount),
    canSubmit = numericAmount >= 100_000 && numericAmount <= data.availableToWithdraw && validIban;
  return (
    <div>
      <header>
        <p className="mb-2 text-sm font-bold text-blue">{fa ? 'کیف پول مدرس' : 'Teacher wallet'}</p>
        <h1 className="text-3xl font-black">{fa ? 'موجودی و برداشت وجه' : 'Balance & withdrawals'}</h1>
        <p className="mt-2 text-muted">
          {fa
            ? 'موجودی‌ات را ببین، مبلغ دلخواه را انتخاب کن و درخواست تسویه بده.'
            : 'View your balance, choose an amount, and request a payout.'}
        </p>
      </header>
      <section className="wallet-hero mt-7 overflow-hidden p-6 text-white md:p-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-center">
          <div>
            <div className="flex items-center gap-2 text-white/70">
              <WalletCards size={20} />
              <span className="text-sm">{fa ? 'موجودی قابل برداشت' : 'Available to withdraw'}</span>
            </div>
            <strong className="mt-3 block text-3xl font-black md:text-4xl">{money(data.availableToWithdraw)}</strong>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-xs text-white/65">
              <span>
                {fa ? 'کل کیف پول: ' : 'Wallet balance: '}
                {money(data.walletBalance)}
              </span>
              {data.reservedAmount > 0 && (
                <span>
                  {fa ? 'در انتظار تسویه: ' : 'Reserved: '}
                  {money(data.reservedAmount)}
                </span>
              )}
            </div>
          </div>
          <form
            className="rounded-2xl bg-white p-5 text-navy shadow-xl"
            onSubmit={(event) => {
              event.preventDefault();
              if (canSubmit) withdraw.mutate();
            }}
          >
            <h2 className="flex items-center gap-2 text-lg font-black">
              <ArrowDownToLine size={20} />
              {fa ? 'درخواست برداشت' : 'Withdraw funds'}
            </h2>
            <div className="mt-4 grid gap-3">
              <label>
                <span className="mb-1.5 block text-xs font-bold">{fa ? 'مبلغ برداشت (تومان)' : 'Amount (IRR)'}</span>
                <div className="relative">
                  <input
                    value={amount}
                    onChange={(event) => setAmount(event.target.value.replace(/\D/g, ''))}
                    inputMode="numeric"
                    className="input pe-20"
                    placeholder={fa ? 'مثلاً ۵۰۰٬۰۰۰' : 'e.g. 500,000'}
                  />
                  <button
                    type="button"
                    onClick={() => setAmount(String(data.availableToWithdraw))}
                    className="absolute inset-y-2 end-2 rounded-lg bg-indigo-50 px-3 text-xs font-bold text-indigo-700"
                  >
                    {fa ? 'کل موجودی' : 'Maximum'}
                  </button>
                </div>
                {amount && numericAmount < 100_000 && (
                  <small className="mt-1 block text-red-600">
                    {fa ? 'حداقل مبلغ برداشت ۱۰۰٬۰۰۰ تومان است.' : 'Minimum withdrawal is 100,000 IRR.'}
                  </small>
                )}
                {numericAmount > data.availableToWithdraw && (
                  <small className="mt-1 block text-red-600">
                    {fa ? 'مبلغ بیشتر از موجودی قابل برداشت است.' : 'Amount exceeds available balance.'}
                  </small>
                )}
                {apiField(withdraw.error, 'amount') && (
                  <small className="mt-1 block text-red-600">{apiField(withdraw.error, 'amount')}</small>
                )}
              </label>
              <label>
                <span className="mb-1.5 block text-xs font-bold">
                  {fa ? 'شماره شبا به نام مدرس' : 'IBAN in teacher’s name'}
                </span>
                <input
                  value={iban}
                  onChange={(event) => setIban(event.target.value.toUpperCase())}
                  dir="ltr"
                  maxLength={26}
                  className="input latin"
                  placeholder="IR000000000000000000000000"
                />
                {iban && !validIban && (
                  <small className="mt-1 block text-red-600">
                    {fa
                      ? 'شبا باید با IR شروع شود و ۲۴ رقم داشته باشد.'
                      : 'IBAN must start with IR followed by 24 digits.'}
                  </small>
                )}
              </label>
              <button
                disabled={!canSubmit || withdraw.isPending}
                className="primary-button justify-center disabled:cursor-not-allowed disabled:opacity-45"
              >
                {withdraw.isPending
                  ? fa
                    ? 'در حال ثبت…'
                    : 'Submitting…'
                  : fa
                    ? 'ثبت درخواست برداشت'
                    : 'Request withdrawal'}
              </button>
              {withdraw.isError && (
                <p role="alert" className="rounded-xl bg-red-50 p-3 text-xs text-red-700">
                  {apiMessage(withdraw.error, fa ? 'ثبت درخواست ناموفق بود.' : 'Could not submit request.')}
                </p>
              )}
              {withdraw.isSuccess && (
                <p role="status" className="rounded-xl bg-emerald-50 p-3 text-xs font-bold text-emerald-700">
                  {fa
                    ? 'درخواست ثبت شد و موجودی آن تا تعیین تکلیف رزرو شد.'
                    : 'Request submitted; the amount is reserved until processed.'}
                </p>
              )}
            </div>
          </form>
        </div>
      </section>
      <section className="mt-5 grid gap-4 sm:grid-cols-3">
        <Metric icon={CircleDollarSign} label={fa ? 'کل درآمد خالص' : 'Lifetime net'} value={money(lifetime)} />
        <Metric icon={ReceiptText} label={fa ? 'تسویه‌شده' : 'Paid out'} value={money(paid)} />
        <Metric
          icon={ShieldCheck}
          label={fa ? 'مبلغ رزروشده' : 'Pending requests'}
          value={money(data.reservedAmount)}
        />
      </section>
      <section className="mt-5 panel-card overflow-hidden">
        <div className="border-b hairline p-5 md:p-6">
          <h2 className="text-xl font-black">{fa ? 'درخواست‌های برداشت' : 'Withdrawal requests'}</h2>
          <p className="mt-1 text-sm text-muted">
            {fa ? 'وضعیت درخواست و شماره پیگیری بانکی' : 'Request status and bank reference'}
          </p>
        </div>
        {data.withdrawals.length ? (
          <div className="overflow-x-auto">
            <table className="teacher-table">
              <thead>
                <tr>
                  <th>{fa ? 'تاریخ' : 'Date'}</th>
                  <th>{fa ? 'مبلغ' : 'Amount'}</th>
                  <th>{fa ? 'شبا' : 'IBAN'}</th>
                  <th>{fa ? 'وضعیت' : 'Status'}</th>
                  <th>{fa ? 'پیگیری' : 'Reference'}</th>
                </tr>
              </thead>
              <tbody>
                {data.withdrawals.map((item) => (
                  <tr key={item.id}>
                    <td>{date(item.createdAt)}</td>
                    <td className="font-black">{money(item.amount)}</td>
                    <td className="latin">{maskIban(item.iban)}</td>
                    <td>
                      <WithdrawalStatus status={item.status} fa={fa} />
                    </td>
                    <td className="latin">{item.reference || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            fa={fa}
            text={fa ? 'هنوز درخواست برداشتی ثبت نکرده‌اید.' : 'You have not requested a withdrawal yet.'}
          />
        )}
      </section>
      <section className="mt-5 panel-card overflow-hidden">
        <div className="border-b hairline p-5 md:p-6">
          <h2 className="text-xl font-black">{fa ? 'ریز درآمد کلاس‌ها' : 'Lesson earnings'}</h2>
          <p className="mt-1 text-sm text-muted">
            {fa ? 'مبلغ ناخالص منهای کارمزد پلتفرم' : 'Gross amount minus platform fee'}
          </p>
        </div>
        {data.earnings.length ? (
          <div className="overflow-x-auto">
            <table className="teacher-table">
              <thead>
                <tr>
                  <th>{fa ? 'تاریخ' : 'Date'}</th>
                  <th>{fa ? 'مبلغ کلاس' : 'Gross'}</th>
                  <th>{fa ? 'کارمزد' : 'Fee'}</th>
                  <th>{fa ? 'سهم شما' : 'Your net'}</th>
                  <th>{fa ? 'وضعیت' : 'Status'}</th>
                </tr>
              </thead>
              <tbody>
                {data.earnings.map((item) => (
                  <tr key={item.id}>
                    <td>{date(item.createdAt)}</td>
                    <td>{money(item.grossAmount)}</td>
                    <td className="text-red-500">− {money(item.commissionAmount)}</td>
                    <td className="font-black text-emerald-700">{money(item.netAmount)}</td>
                    <td>
                      <EarningStatus status={item.status} fa={fa} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            fa={fa}
            text={
              fa
                ? 'بعد از تکمیل اولین کلاس، درآمد اینجا نمایش داده می‌شود.'
                : 'Earnings appear after your first completed class.'
            }
          />
        )}
      </section>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <article className="panel-card p-5">
      <span className="grid size-10 place-items-center rounded-xl bg-slate-100 text-slate-600">
        <Icon size={20} />
      </span>
      <p className="mt-4 text-sm text-muted">{label}</p>
      <strong className="mt-1 block text-2xl font-black">{value}</strong>
    </article>
  );
}
function EarningStatus({ status, fa }: { status: string; fa: boolean }) {
  const paid = status === 'PAID',
    eligible = status === 'ELIGIBLE';
  return (
    <span className={`status-pill ${paid ? 'status-success' : eligible ? 'status-info' : 'status-warning'}`}>
      {paid
        ? fa
          ? 'تسویه‌شده'
          : 'Paid'
        : eligible
          ? fa
            ? 'آماده برداشت'
            : 'Available'
          : fa
            ? 'در حال آزادسازی'
            : 'On hold'}
    </span>
  );
}
function WithdrawalStatus({ status, fa }: { status: string; fa: boolean }) {
  const map: Record<string, [string, string, string]> = {
    PENDING: ['در صف بررسی', 'Pending', 'status-warning'],
    APPROVED: ['تأییدشده', 'Approved', 'status-info'],
    TRANSFERRED: ['واریزشده', 'Transferred', 'status-success'],
    REJECTED: ['ردشده', 'Rejected', 'bg-red-50 text-red-700'],
  };
  const item = map[status] ?? [status, status, 'status-info'];
  return <span className={`status-pill ${item[2]}`}>{item[fa ? 0 : 1]}</span>;
}
function Empty({ fa, text }: { fa: boolean; text: string }) {
  return (
    <div className="grid min-h-40 place-items-center p-8 text-center">
      <div>
        <Clock3 className="mx-auto text-muted" />
        <p className="mt-3 text-sm text-muted">{text}</p>
      </div>
    </div>
  );
}
function maskIban(iban: string) {
  return `${iban.slice(0, 4)} •••• •••• •••• ${iban.slice(-4)}`;
}
