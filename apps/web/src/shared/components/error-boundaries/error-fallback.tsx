'use client';

type ErrorFallbackProps = {
  onRetry: () => void;
  title?: string;
  description?: string;
};

export function ErrorFallback({
  onRetry,
  title = 'این بخش موقتاً در دسترس نیست',
  description = 'مشکلی پیش آمده است. اطلاعات حساس خطا نمایش داده نمی‌شود؛ دوباره تلاش کنید.',
}: ErrorFallbackProps) {
  return (
    <section role="alert" className="panel-card mx-auto my-6 max-w-xl p-6 text-center">
      <h2 className="text-lg font-black">{title}</h2>
      <p className="mt-3 text-sm leading-7 text-muted">{description}</p>
      <button type="button" onClick={onRetry} className="primary-button mt-5">
        تلاش دوباره
      </button>
    </section>
  );
}
