import Link from 'next/link';
import { requestLocale } from '@/lib/server-locale';
import { localePath, localized, isDefaultLocale, translate } from '@/lib/i18n';
export default async function Pending() {
  const locale = await requestLocale(),
    fa = isDefaultLocale(locale);
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <div className="max-w-md text-center">
        <div className="skeleton mx-auto h-16 w-16 rounded-full" />
        <h1 className="mt-6 text-4xl font-black">{translate(locale, 'paymentpendingPaymentIsBeingReviewed')}</h1>
        <p className="mt-4 leading-7 text-muted">
          {translate(locale, 'paymentpendingTheDashboardWillUpdateAfterServerSideConfirmation')}
        </p>
        <Link
          href={localePath('/dashboard/wallet', locale)}
          className="mt-7 inline-block font-bold text-blue underline"
        >
          {translate(locale, 'paymentpendingViewStatus')}
        </Link>
      </div>
    </main>
  );
}
