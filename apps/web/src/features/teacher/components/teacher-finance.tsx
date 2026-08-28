'use client';

import { localized, isDefaultLocale, translate } from '@/lib/i18n';
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
    fa = isDefaultLocale(locale),
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
        {translate(locale, 'teacherteacherFinanceCouldNotLoadWalletData')}
      </div>
    );
  const data = query.data!,
    paid = data.totals.find((x) => x.status === 'PAID')?._sum.netAmount ?? 0,
    lifetime = data.totals.reduce((sum, x) => sum + (x._sum.netAmount ?? 0), 0);
  const money = (value: number) =>
      `${new Intl.NumberFormat(translate(locale, 'commercepricingManagerEnUS2')).format(value)} ${translate(locale, 'teacherteacherFinanceIrr')}`,
    date = (value: string) =>
      new Intl.DateTimeFormat(translate(locale, 'commercepricingManagerEnUS2'), { dateStyle: 'medium' }).format(
        new Date(value),
      );
  const validIban = /^IR\d{24}$/.test(iban.replace(/\s/g, '').toUpperCase()),
    numericAmount = Number(amount),
    canSubmit = numericAmount >= 100_000 && numericAmount <= data.availableToWithdraw && validIban;
  return (
    <div>
      <header>
        <p className="mb-2 text-sm font-bold text-blue">{translate(locale, 'teacherteacherFinanceTeacherWallet')}</p>
        <h1 className="text-3xl font-black">{translate(locale, 'teacherteacherFinanceBalanceWithdrawals')}</h1>
        <p className="mt-2 text-muted">
          {translate(locale, 'teacherteacherFinanceViewYourBalanceChooseAnAmountAndRequest')}
        </p>
      </header>
      <section className="wallet-hero mt-7 overflow-hidden p-6 text-white md:p-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-center">
          <div>
            <div className="flex items-center gap-2 text-white/70">
              <WalletCards size={20} />
              <span className="text-sm">{translate(locale, 'teacherteacherFinanceAvailableToWithdraw')}</span>
            </div>
            <strong className="mt-3 block text-3xl font-black md:text-4xl">{money(data.availableToWithdraw)}</strong>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-xs text-white/65">
              <span>
                {translate(locale, 'teacherteacherFinanceWalletBalance')}
                {money(data.walletBalance)}
              </span>
              {data.reservedAmount > 0 && (
                <span>
                  {translate(locale, 'teacherteacherFinanceReserved')}
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
              {translate(locale, 'teacherteacherFinanceWithdrawFunds')}
            </h2>
            <div className="mt-4 grid gap-3">
              <label>
                <span className="mb-1.5 block text-xs font-bold">
                  {translate(locale, 'teacherteacherFinanceAmountIRR')}
                </span>
                <div className="relative">
                  <input
                    value={amount}
                    onChange={(event) => setAmount(event.target.value.replace(/\D/g, ''))}
                    inputMode="numeric"
                    className="input pe-20"
                    placeholder={translate(locale, 'teacherteacherFinanceEG500000')}
                  />
                  <button
                    type="button"
                    onClick={() => setAmount(String(data.availableToWithdraw))}
                    className="absolute inset-y-2 end-2 rounded-lg bg-indigo-50 px-3 text-xs font-bold text-indigo-700"
                  >
                    {translate(locale, 'teacherteacherFinanceMaximum')}
                  </button>
                </div>
                {amount && numericAmount < 100_000 && (
                  <small className="mt-1 block text-red-600">
                    {translate(locale, 'teacherteacherFinanceMinimumWithdrawalIs100000IRR')}
                  </small>
                )}
                {numericAmount > data.availableToWithdraw && (
                  <small className="mt-1 block text-red-600">
                    {translate(locale, 'teacherteacherFinanceAmountExceedsAvailableBalance')}
                  </small>
                )}
                {apiField(withdraw.error, 'amount') && (
                  <small className="mt-1 block text-red-600">{apiField(withdraw.error, 'amount')}</small>
                )}
              </label>
              <label>
                <span className="mb-1.5 block text-xs font-bold">
                  {translate(locale, 'teacherteacherFinanceIbanInTeacherSName')}
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
                    {translate(locale, 'teacherteacherFinanceIbanMustStartWithIRFollowedBy24')}
                  </small>
                )}
              </label>
              <button
                disabled={!canSubmit || withdraw.isPending}
                className="primary-button justify-center disabled:cursor-not-allowed disabled:opacity-45"
              >
                {withdraw.isPending
                  ? translate(locale, 'teacherteacherFinanceSubmitting')
                  : translate(locale, 'teacherteacherFinanceRequestWithdrawal')}
              </button>
              {withdraw.isError && (
                <p role="alert" className="rounded-xl bg-red-50 p-3 text-xs text-red-700">
                  {apiMessage(withdraw.error, translate(locale, 'teacherteacherFinanceCouldNotSubmitRequest'))}
                </p>
              )}
              {withdraw.isSuccess && (
                <p role="status" className="rounded-xl bg-emerald-50 p-3 text-xs font-bold text-emerald-700">
                  {translate(locale, 'teacherteacherFinanceRequestSubmittedTheAmountIsReservedUntilProcessed')}
                </p>
              )}
            </div>
          </form>
        </div>
      </section>
      <section className="mt-5 grid gap-4 sm:grid-cols-3">
        <Metric
          icon={CircleDollarSign}
          label={translate(locale, 'teacherteacherFinanceLifetimeNet')}
          value={money(lifetime)}
        />
        <Metric icon={ReceiptText} label={translate(locale, 'teacherteacherFinancePaidOut')} value={money(paid)} />
        <Metric
          icon={ShieldCheck}
          label={translate(locale, 'teacherteacherFinancePendingRequests')}
          value={money(data.reservedAmount)}
        />
      </section>
      <section className="mt-5 panel-card overflow-hidden">
        <div className="border-b hairline p-5 md:p-6">
          <h2 className="text-xl font-black">{translate(locale, 'teacherteacherFinanceWithdrawalRequests')}</h2>
          <p className="mt-1 text-sm text-muted">
            {translate(locale, 'teacherteacherFinanceRequestStatusAndBankReference')}
          </p>
        </div>
        {data.withdrawals.length ? (
          <div className="overflow-x-auto">
            <table className="teacher-table">
              <thead>
                <tr>
                  <th>{translate(locale, 'schedulingteacherPlannerCalendarDate')}</th>
                  <th>{translate(locale, 'teacherteacherFinanceAmount')}</th>
                  <th>{translate(locale, 'teacherteacherFinanceIban')}</th>
                  <th>{translate(locale, 'commercepricingManagerStatus')}</th>
                  <th>{translate(locale, 'teacherteacherFinanceReference')}</th>
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
          <Empty fa={fa} text={translate(locale, 'teacherteacherFinanceYouHaveNotRequestedAWithdrawalYet')} />
        )}
      </section>
      <section className="mt-5 panel-card overflow-hidden">
        <div className="border-b hairline p-5 md:p-6">
          <h2 className="text-xl font-black">{translate(locale, 'teacherteacherFinanceLessonEarnings')}</h2>
          <p className="mt-1 text-sm text-muted">
            {translate(locale, 'teacherteacherFinanceGrossAmountMinusPlatformFee')}
          </p>
        </div>
        {data.earnings.length ? (
          <div className="overflow-x-auto">
            <table className="teacher-table">
              <thead>
                <tr>
                  <th>{translate(locale, 'schedulingteacherPlannerCalendarDate')}</th>
                  <th>{translate(locale, 'teacherteacherFinanceGross')}</th>
                  <th>{translate(locale, 'teacherteacherFinanceFee')}</th>
                  <th>{translate(locale, 'teacherteacherFinanceYourNet')}</th>
                  <th>{translate(locale, 'commercepricingManagerStatus')}</th>
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
          <Empty fa={fa} text={translate(locale, 'teacherteacherFinanceEarningsAppearAfterYourFirstCompletedClass')} />
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
        ? translate(fa, 'teacherteacherFinancePaid')
        : eligible
          ? translate(fa, 'teacherteacherFinanceAvailable')
          : translate(fa, 'teacherteacherFinanceOnHold')}
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
  return <span className={`status-pill ${item[2]}`}>{item[localized({ fa: 0, en: 1 }, fa)]}</span>;
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
