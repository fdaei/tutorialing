'use client';

import { useTranslations } from '@/components/shared/locale-provider';

type ErrorFallbackProps = {
  onRetry: () => void;
  title?: string;
  description?: string;
};

export function ErrorFallback({
  onRetry,
  title,
  description,
}: ErrorFallbackProps) {
  const { locale } = useTranslations();
  const english = locale === 'en';
  return (
    <section role="alert" className="panel-card mx-auto my-6 max-w-xl p-6 text-center">
      <h2 className="text-lg font-black">{title ?? (english ? 'This section is temporarily unavailable' : 'این بخش موقتاً در دسترس نیست')}</h2>
      <p className="mt-3 text-sm leading-7 text-muted">{description ?? (english ? 'The request could not be completed. Try again; sensitive error details are never shown here.' : 'درخواست انجام نشد. دوباره تلاش کنید؛ اطلاعات حساس خطا در اینجا نمایش داده نمی‌شود.')}</p>
      <button type="button" onClick={onRetry} className="primary-button mt-5">
        {english ? 'Try again' : 'تلاش دوباره'}
      </button>
    </section>
  );
}
