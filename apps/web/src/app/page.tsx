import { publicApi } from '@/shared/services/api';
import type { Course } from '@/lib/marketplace-data';
import type { EducationalLanguage } from '@/features/languages';
import type { BlogPostsPage } from '@/features/blog/types';
import { requestLocale } from '@/lib/server-locale';
import { logWarning } from '@/shared/services/error-logger';
import { LandingHome } from '@/features/landing/components/landing-home';
import { defaultLandingConfig, mediaReference, normalizeLandingConfig, type LandingConfig } from '@/features/landing';

export const dynamic = 'force-dynamic';

const EMPTY_POSTS: BlogPostsPage = { items: [], page: 1, pageSize: 0 };
type PublicSetting = { key: string; value: unknown; public: boolean };

function withFallback<T>(endpoint: string, request: Promise<T>, fallback: T): Promise<T> {
  return request.catch((error: unknown) => {
    logWarning(error, { scope: 'route', name: `home:${endpoint}` });
    return fallback;
  });
}

async function resolveMedia(value: string, fallback = defaultLandingConfig.hero.image) {
  const id = mediaReference(value);
  if (!id) return value;
  const result = await withFallback(`/files/public/${id}`, publicApi<{ url: string }>(`/files/public/${id}`), { url: '' });
  return result.url || fallback;
}

async function hydrateMedia(config: LandingConfig): Promise<LandingConfig> {
  const [logo, heroImage, placementImage, languageCards] = await Promise.all([
    resolveMedia(config.brand.logo, ''),
    resolveMedia(config.hero.image),
    resolveMedia(config.placement.image),
    Promise.all(config.languages.cards.map(async (card) => ({ ...card, image: await resolveMedia(card.image) }))),
  ]);
  return {
    ...config,
    brand: { ...config.brand, logo },
    hero: { ...config.hero, image: heroImage },
    placement: { ...config.placement, image: placementImage },
    languages: { ...config.languages, cards: languageCards },
  };
}

// The image uploaded in the admin language manager is stored as imageId; like
// /languages, resolve it here so the landing cards can show it.
function withLanguageImages(items: EducationalLanguage[]) {
  return Promise.all(
    items.map(async (language) => {
      if (!language.imageId) return language;
      const media = await withFallback(`/files/public/${language.imageId}`, publicApi<{ url: string }>(`/files/public/${language.imageId}`), { url: '' });
      return media.url ? { ...language, imageUrl: media.url } : language;
    }),
  );
}

export default async function Home() {
  const [languages, courses, posts, settings, locale] = await Promise.all([
    withFallback('/languages', publicApi<EducationalLanguage[]>('/languages').then(withLanguageImages), []),
    withFallback('/courses', publicApi<Course[]>('/courses'), []),
    withFallback('/blog/posts', publicApi<BlogPostsPage>('/blog/posts?pageSize=3'), EMPTY_POSTS),
    withFallback('/support/public-settings', publicApi<PublicSetting[]>('/support/public-settings'), []),
    requestLocale(),
  ]);
  const landingSetting = settings.find((setting) => setting.key === 'landing.page')?.value;
  const themeSetting = settings.find((setting) => setting.key === 'theme.settings')?.value;
  const config = normalizeLandingConfig({
    ...((landingSetting && typeof landingSetting === 'object' ? landingSetting : {}) as Record<string, unknown>),
    theme: themeSetting,
  });
  return <LandingHome config={await hydrateMedia(config)} locale={locale} languages={languages} courses={courses} posts={posts} />;
}
