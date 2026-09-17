import { Footer, Header, PublicPageHero } from '@/components/layout/site';
import { publicApi } from '@/shared/services/api';
import type { EducationalLanguage } from '@/features/languages';
import { LanguageDiscoveryCard } from '@/features/languages/components/language-discovery-card';
import { requestLocale } from '@/lib/server-locale';
import { resolveHeaderConfig } from '@/lib/header-config';

export const dynamic = 'force-dynamic';

async function withImageUrls(items: EducationalLanguage[]) {
  return Promise.all(
    items.map(async (language) => {
      if (!language.imageId) return language;
      try {
        const media = await publicApi<{ url: string }>(`/files/public/${language.imageId}`);
        return { ...language, imageUrl: media.url };
      } catch {
        return language;
      }
    }),
  );
}

export default async function LanguagesPage() {
  const [items, locale, headerConfig] = await Promise.all([
    publicApi<EducationalLanguage[]>('/languages').then(withImageUrls),
    requestLocale(),
    resolveHeaderConfig(),
  ]);
  return (
    <>
      <Header config={headerConfig} />
      <main className="page-shell section-space">
        <PublicPageHero
          eyebrow={locale === 'en' ? 'Choose your learning path' : 'مسیر یادگیریت را انتخاب کن'}
          title={locale === 'en' ? 'One language. A clear route forward.' : 'یک زبان، یک مسیر روشن برای پیشرفت.'}
          description={
            locale === 'en'
              ? 'Choose a language to see its CEFR route, focused courses, placement options and verified teachers in one place.'
              : 'زبان را انتخاب کن تا مسیر CEFR، دوره‌های هدفمند، تعیین سطح و مدرس‌های مرتبط را یکجا ببینی.'
          }
        />
        {items.length ? (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
