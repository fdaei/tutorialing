import Link from 'next/link';
import { requestLocale } from '@/lib/server-locale';
import { localePath, localized, isDefaultLocale, translate } from '@/lib/i18n';
// The copy used to send people to "the payments dashboard" while the only link
// went to the wallet, and offered no route back to what they were paying for.
// A failed booking payment is now retryable — the failed attempt releases the
// booking's payment slot — so the primary action points at the classes panel
// where the still-unpaid booking is listed.
export default async function Failure() {
  const locale = await requestLocale(),
    fa = isDefaultLocale(locale);
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <div className="w-full max-w-md text-center">
        <span className="text-6xl text-red-500">×</span>
        <h1 className="mt-5 text-3xl font-black sm:text-4xl">{translate(locale, 'paymentfailurePaymentFailed')}</h1>
        <p className="mt-4 leading-7 text-muted">{translate(locale, 'paymentfailureYouWereNotChargedIfThisWasFor')}</p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href={localePath('/dashboard/classes', locale)}
            className="rounded-xl bg-navy px-7 py-4 font-black text-white"
          >
            {translate(locale, 'paymentfailureGoToMyClasses')}
          </Link>
          <Link
            href={localePath('/dashboard/wallet', locale)}
            className="rounded-xl border hairline px-7 py-4 font-black"
          >
            {translate(locale, 'paymentfailureViewPayments')}
          </Link>
        </div>
      </div>
    </main>
  );
}
