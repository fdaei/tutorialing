'use client';
import { useSearchParams, useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { publicApi } from '@/lib/api';
import { useTranslations } from '@/components/shared/locale-provider';
import { localePath } from '@/lib/i18n';
export default function DevelopmentPayment() {
  const authority = useSearchParams().get('authority') ?? '',
    router = useRouter(),
    { locale, t } = useTranslations();
  const verify = useMutation({
    mutationFn: () => publicApi(`/payments/callback?Authority=${encodeURIComponent(authority)}&Status=OK`),
    onSuccess: () => router.replace(localePath('/payment/success', locale)),
  });
  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f8fc] p-6">
      <div className="max-w-md rounded-4xl border hairline bg-white p-8 text-center shadow-soft">
        <p className="text-sm font-black text-purple">{t('developmentGateway')}</p>
        <h1 className="mt-4 text-3xl font-black">{t('paymentSimulator')}</h1>
        <p className="mt-4 leading-7 text-muted">{t('paymentSimulatorDescription')}</p>
        <button
          disabled={verify.isPending}
          onClick={() => verify.mutate()}
          className="brand-gradient mt-7 w-full rounded-full py-4 font-black text-white"
        >
          {t(verify.isPending ? 'verifying' : 'confirmDevelopmentPayment')}
        </button>
        {verify.isError && (
          <p role="alert" className="mt-4 text-red-700">
            {t('verificationFailed')}
          </p>
        )}
      </div>
    </main>
  );
}
