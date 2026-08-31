import { Footer, Header } from '@/components/layout/site';
import { publicApi } from '@/shared/services/api';
import type { EducationalLanguage } from '@/features/languages';
import { LanguageDiscoveryCard } from '@/features/languages/components/language-discovery-card';
import { requestLocale } from '@/lib/server-locale';

export const dynamic = 'force-dynamic';

export default async function LanguagesPage() {
  const [items, locale] = await Promise.all([publicApi<EducationalLanguage[]>('/languages'), requestLocale()]);
  return (
    <>
      <Header />
      <main className="page-shell section-space">
        <p className="text-sm font-black text-purple">چه زبانی می‌خواهید یاد بگیرید؟</p>
        <h1 className="mt-3 text-4xl font-black md:text-5xl">زبان‌ها</h1>
        <p className="mt-4 max-w-2xl leading-8 text-muted">
          زبان را انتخاب کنید تا دوره‌ها، تعیین سطح و مدرس‌های مرتبط را در یک مسیر روشن ببینید.
        </p>
        {items.length ? (
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {items.map((language) => (
              <LanguageDiscoveryCard key={language.id} language={language} locale={locale} />
            ))}
          </div>
        ) : (
          <div className="review-empty mt-10">
            <strong>هنوز زبانی برای یادگیری منتشر نشده است</strong>
            <p>فهرست زبان‌ها پس از آماده‌شدن مسیرهای آموزشی نمایش داده می‌شود.</p>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
