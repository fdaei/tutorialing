'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, History, ReceiptText, Upload, WalletCards } from 'lucide-react';
import { apiMessage, publicApi } from '@/shared/services/api';
import { upload, uploadErrorMessage } from '@/shared/services/upload';
import { digitsOnly, faNumber, jalali, toman } from '@/lib/format';
import { walletService, type Invoice, type Transaction } from '@/lib/wallet-service';
import { EmptyState, PageHeading } from '@/components/shared/page-heading';
export function StudentWallet() {
  const [tab, setTab] = useState<'topup' | 'transactions' | 'invoices'>('transactions');
  // TODO(zarinpal): gateway top-up state, hidden until the gateway goes live.
  // const [amount, setAmount] = useState(250000), [code, setCode] = useState('');
  const wallet = useQuery({ queryKey: ['wallet'], queryFn: walletService.getWallet }),
    transactions = useQuery({ queryKey: ['wallet-transactions'], queryFn: walletService.getTransactions }),
    invoices = useQuery({ queryKey: ['wallet-invoices'], queryFn: walletService.getInvoices });
  // pay = useMutation({
  //   mutationFn: () => walletService.topUp({ amount, gateway: 'zarinpal', discountCode: code || undefined }),
  //   onSuccess: (result) => {
  //     if (result.url) location.href = result.url;
  //   },
  // });
  return (
    <>
      <PageHeading
        title="کیف پول و پرداخت‌ها"
        description="موجودی، پرداخت‌ها، گردش حساب و فاکتورهای خود را یک‌جا مدیریت کنید."
      />
      <section className="wallet-hero p-6 text-white md:p-8">
        <p className="flex items-center gap-2 text-sm text-white/70">
          <WalletCards />
          موجودی قابل استفاده
        </p>
        {wallet.isLoading ? (
          <div className="skeleton mt-4 h-12 w-52 rounded-xl" />
        ) : (
          <strong className="mt-3 block text-4xl">{toman(wallet.data?.balance ?? 0)}</strong>
        )}
        <p className="mt-4 text-xs text-white/60">موجودی از دفتر کل مالی محاسبه می‌شود.</p>
      </section>
      {wallet.isError && (
        <Error text={apiMessage(wallet.error, 'موجودی دریافت نشد.')} onRetry={() => void wallet.refetch()} />
      )}
      <nav className="mt-6 flex gap-2 overflow-auto rounded-2xl bg-white p-2 shadow-soft">
        {(
          [
            ['topup', 'ثبت رسید پرداخت'],
            ['transactions', 'گردش حساب'],
            ['invoices', 'فاکتورها'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`shrink-0 rounded-xl px-5 py-3 text-sm font-bold ${tab === id ? 'bg-indigo-600 text-white' : 'text-muted'}`}
          >
            {label}
          </button>
        ))}
      </nav>
      {tab === 'topup' && <ReceiptTopUp />}
      {/*
        TODO(zarinpal): online top-up is hidden until the Zarinpal gateway contract
        is signed. Restore this block (and `pay` above) and drop <ReceiptTopUp />.

              {tab === 'topup' && (
                <section className="mt-5 grid gap-5 lg:grid-cols-[1fr_340px]">
                  <div className="panel-card p-6">
                    <h2 className="font-black">افزایش موجودی</h2>
                    <label className="mt-5 block">
                      <span className="mb-2 block text-sm font-bold">مبلغ</span>
                      <div className="relative">
                        <input
                          value={faNumber(amount)}
                          inputMode="numeric"
                          onChange={(e) => setAmount(Number(digitsOnly(e.target.value)) || 0)}
                          className="input pl-20 font-black"
                        />
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted">تومان</span>
                      </div>
                    </label>
                    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {[100000, 250000, 500000, 1000000].map((v) => (
                        <button
                          onClick={() => setAmount(v)}
                          key={v}
                          className={`rounded-xl border p-3 text-xs font-bold ${amount === v ? 'border-indigo-600 bg-indigo-50' : 'hairline'}`}
                        >
                          {toman(v)}
                        </button>
                      ))}
                    </div>
                    <label className="mt-5 flex items-center gap-3 rounded-xl border hairline p-4">
                      <Landmark className="text-indigo-600" />
                      <span>
                        <b className="block text-sm">درگاه پرداخت امن</b>
                        <small className="text-muted">کارت‌های عضو شتاب</small>
                      </span>
                    </label>
                    <label className="mt-5 block">
                      <span className="mb-2 block text-sm font-bold">کد تخفیف</span>
                      <input value={code} onChange={(e) => setCode(e.target.value)} className="input" />
                    </label>
                  </div>
                  <aside className="panel-card h-fit p-6">
                    <h2 className="font-black">خلاصه پرداخت</h2>
                    <div className="mt-6 flex justify-between">
                      <span className="text-muted">مبلغ نهایی</span>
                      <b>{toman(amount)}</b>
                    </div>
                    {pay.isError && <Error text={apiMessage(pay.error, 'سرویس شارژ هنوز فعال نشده است.')} />}
                    <button
                      disabled={amount < 100000 || pay.isPending}
                      onClick={() => pay.mutate()}
                      className="primary-button mt-6 w-full justify-center"
                    >
                      پرداخت و افزایش موجودی
                    </button>
                  </aside>
                </section>
              )}
      */}
      {tab === 'transactions' && (
        <Transactions
          loading={transactions.isLoading}
          error={transactions.isError}
          retry={() => void transactions.refetch()}
          items={transactions.data ?? []}
        />
      )}{' '}
      {tab === 'invoices' && (
        <Invoices
          loading={invoices.isLoading}
          error={invoices.isError}
          retry={() => void invoices.refetch()}
          items={invoices.data ?? []}
        />
      )}
    </>
  );
}
function Transactions({
  loading,
  error,
  retry,
  items,
}: {
  loading: boolean;
  error: boolean;
  retry: () => void;
  items: Transaction[];
}) {
  if (loading) return <Loading />;
  if (error) return <Error text="گردش حساب دریافت نشد." onRetry={retry} />;
  if (!items.length)
    return (
      <div className="mt-5">
        <EmptyState
          icon={<History />}
          title="تراکنشی وجود ندارد"
          description="تغییرات موجودی در این بخش نمایش داده می‌شود."
        />
      </div>
    );
  return (
    <div className="panel-card mt-5 overflow-hidden">
      {items.map((item) => (
        <article
          key={item.id}
          className="grid gap-3 border-b hairline p-5 last:border-0 md:grid-cols-[1.5fr_1fr_1fr_1fr] md:items-center"
        >
          <div>
            <b className="text-sm">{item.title}</b>
            <small className="mt-1 block text-muted">{item.paymentMethod} · موفق</small>
          </div>
          <div>
            <small>{jalali(item.createdAt)}</small>
            <small dir="ltr" className="mt-1 block text-muted">
              {item.trackingId}
            </small>
          </div>
          <span className="text-sm">مانده: {toman(item.balanceAfter)}</span>
          <strong className={item.direction === 'CREDIT' ? 'text-emerald-600' : 'text-red-600'}>
            {item.direction === 'CREDIT' ? '+' : '−'} {toman(item.amount)}
          </strong>
        </article>
      ))}
    </div>
  );
}
function Invoices({
  loading,
  error,
  retry,
  items,
}: {
  loading: boolean;
  error: boolean;
  retry: () => void;
  items: Invoice[];
}) {
  if (loading) return <Loading />;
  if (error) return <Error text="فاکتورها دریافت نشدند." onRetry={retry} />;
  if (!items.length)
    return (
      <div className="mt-5">
        <EmptyState icon={<FileText />} title="فاکتوری وجود ندارد" description="فاکتور پرداخت‌ها اینجا قرار می‌گیرد." />
      </div>
    );
  return (
    <div className="mt-5 grid gap-3">
      {items.map((item) => (
        <article key={item.id} className="panel-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <ReceiptText className="text-indigo-600" />
          <div className="flex-1">
            <b>{item.title}</b>
            <small className="mt-1 block text-muted">
              {item.number} · {jalali(item.createdAt)}
            </small>
            {item.status === 'FAILED' && item.hasReceipt && item.reviewNote && (
              <small className="mt-1 block text-red-700">دلیل رد: {item.reviewNote}</small>
            )}
          </div>
          <strong>{toman(item.amount)}</strong>
          <span className={`status-pill ${invoiceStatus(item).tone}`}>{invoiceStatus(item).label}</span>
          <button onClick={() => window.print()} className="secondary-button justify-center">
            چاپ
          </button>
        </article>
      ))}
    </div>
  );
}
function invoiceStatus(item: Invoice) {
  if (item.status === 'PAID') return { label: 'پرداخت‌شده', tone: 'status-success' };
  if (item.hasReceipt && item.status === 'PENDING') return { label: 'در انتظار تأیید', tone: 'status-warning' };
  if (item.hasReceipt && item.status === 'FAILED') return { label: 'رد شده', tone: 'bg-red-50 text-red-700' };
  return { label: item.status, tone: 'status-info' };
}

const RECEIPT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

/**
 * Card-to-card top-up: the student uploads the bank receipt and the wallet is
 * credited once an admin approves it in the finance center.
 */
export function ReceiptTopUp({
  course,
  sessions,
}: {
  course?: { id: string; price: number };
  sessions?: Array<{ startsAt: string; endsAt: string; timezone: string }>;
}) {
  const queryClient = useQueryClient();
  const paymentSettings = useQuery({
    queryKey: ['public-payment-card'],
    queryFn: async () => {
      const settings = await publicApi<Array<{ key: string; value: unknown }>>('/support/public-settings');
      return settings.find((item) => item.key === 'payment.card')?.value as
        | { cardNumber?: string; holder?: string; bank?: string }
        | undefined;
    },
  });
  const [typedAmount, setAmount] = useState(0),
    [file, setFile] = useState<File>(),
    [note, setNote] = useState('');
  // A course receipt always pays the course price; the server enforces it too.
  const amount = course ? course.price : typedAmount;
  const submit = useMutation({
    mutationFn: async () => {
      if (!file) throw new globalThis.Error('receipt missing');
      const { fileId } = await upload({
        body: file,
        originalName: file.name,
        mimeType: file.type,
        purpose: 'payment-receipt',
      });
      return walletService.submitReceipt({
        amount,
        receiptFileId: fileId,
        note: note.trim() || undefined,
        courseId: course?.id,
        sessions,
      });
    },
    onSuccess: async () => {
      setAmount(0);
      setFile(undefined);
      setNote('');
      await queryClient.invalidateQueries({ queryKey: ['wallet-invoices'] });
      if (course) await queryClient.invalidateQueries({ queryKey: ['course-receipt', course.id] });
    },
  });
  return (
    <section className="panel-card mt-5 p-6">
      <h2 className="font-black">{course ? 'خرید دوره با رسید پرداخت' : 'ثبت رسید پرداخت'}</h2>
      <p className="mt-2 text-sm text-muted">
        {course
          ? 'مبلغ دوره را کارت‌به‌کارت واریز کنید و تصویر یا PDF رسید را بارگذاری کنید. پس از تأیید پشتیبانی، دوره به «دوره‌های من» اضافه می‌شود.'
          : 'مبلغ را کارت‌به‌کارت واریز کنید و تصویر یا PDF رسید را بارگذاری کنید. پس از تأیید پشتیبانی، موجودی کیف پول شما افزایش می‌یابد.'}
      </p>
      {course && paymentSettings.data?.cardNumber ? (
        <div className="mt-4 rounded-2xl border hairline bg-slate-50 p-4 text-sm">
          <p className="text-xs font-bold text-muted">واریز به کارت اعلام‌شده توسط مدیریت</p>
          <p className="latin mt-2 text-lg font-black" dir="ltr">
            {paymentSettings.data.cardNumber}
          </p>
          <p className="mt-1 text-xs text-muted">
            {[paymentSettings.data.holder, paymentSettings.data.bank].filter(Boolean).join(' · ')}
          </p>
        </div>
      ) : null}
      {course && sessions?.length ? (
        <p className="mt-4 rounded-xl bg-indigo-50 p-3 text-sm font-bold text-indigo-800">
          {sessions.length.toLocaleString('fa-IR')} نوبت انتخاب شده همراه رسید برای تأیید مدیر ثبت می‌شود.
        </p>
      ) : null}
      <label className="mt-5 block">
        <span className="mb-2 block text-sm font-bold">مبلغ واریزی</span>
        <div className="relative">
          <input
            readOnly={Boolean(course)}
            value={amount ? faNumber(amount) : ''}
            inputMode="numeric"
            onChange={(e) => setAmount(Number(digitsOnly(e.target.value)) || 0)}
            className="input pl-20 font-black"
          />
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted">تومان</span>
        </div>
      </label>
      <label className="secondary-button mt-5 cursor-pointer justify-center">
        <Upload size={17} />
        {file ? file.name : 'انتخاب فایل رسید'}
        <input
          type="file"
          accept={RECEIPT_TYPES.join(',')}
          className="sr-only"
          onChange={(e) => setFile(e.target.files?.[0])}
        />
      </label>
      <label className="mt-5 block">
        <span className="mb-2 block text-sm font-bold">توضیحات (اختیاری)</span>
        <input value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} className="input" />
      </label>
      {submit.isError && <Error text={uploadErrorMessage(submit.error, 'ثبت رسید انجام نشد.')} />}
      {submit.isSuccess && (
        <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">
          {course
            ? 'رسید ثبت شد. پس از تأیید، دوره در «دوره‌های من» فعال می‌شود.'
            : 'رسید ثبت شد و پس از بررسی، موجودی شما افزایش می‌یابد. وضعیت را در تب فاکتورها ببینید.'}
        </p>
      )}
      <button
        disabled={(!course && amount < 10000) || !file || !RECEIPT_TYPES.includes(file.type) || submit.isPending}
        onClick={() => submit.mutate()}
        className="primary-button mt-6 w-full justify-center disabled:opacity-50"
      >
        {submit.isPending ? 'در حال ارسال…' : 'ثبت رسید'}
      </button>
    </section>
  );
}

function Loading() {
  return <div className="skeleton mt-5 h-64 rounded-2xl" />;
}
function Error({ text, onRetry }: { text: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
      <p>{text}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-2 font-black underline">
          تلاش دوباره
        </button>
      )}
    </div>
  );
}
