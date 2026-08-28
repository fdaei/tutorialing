import Link from 'next/link';
import { Check } from 'lucide-react';
import { requestLocale } from '@/lib/server-locale';
import { localePath, localized, isDefaultLocale, translate } from '@/lib/i18n';
export default async function Success() {
  const locale = await requestLocale(),
    fa = isDefaultLocale(locale);
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <div className="text-center">
        <span className="brand-gradient mx-auto grid h-20 w-20 place-items-center rounded-full text-white">
          <Check size={38} />
        </span>
        <h1 className="mt-7 text-4xl font-black">{translate(locale, 'paymentsuccessPaymentConfirmed')}</h1>
        <p className="mt-4 text-muted">{translate(locale, 'paymentsuccessYourBookingOrPackageIsNowAvailableIn')}</p>
        <Link
          href={localePath('/dashboard', locale)}
          className="brand-gradient mt-7 inline-block rounded-xl px-7 py-4 font-black text-white"
        >
          {translate(locale, 'paymentsuccessGoToDashboard')}
        </Link>
      </div>
    </main>
  );
}
