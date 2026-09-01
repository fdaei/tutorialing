import { translate, type Locale } from '@/lib/i18n';

export function CheckoutLoadError({ locale, onRetry }: { locale: Locale; onRetry: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f8fc] p-6">
      <div role="alert" className="w-full max-w-md rounded-3xl border hairline bg-white p-8 text-center shadow-soft">
        <h1 className="text-2xl font-black">{translate(locale, 'genericError')}</h1>
        <button
          type="button"
          onClick={onRetry}
          className="brand-gradient mt-6 rounded-xl px-6 py-3 font-black text-white"
        >
          {translate(locale, 'legacyTryAgain')}
        </button>
      </div>
    </main>
  );
}
