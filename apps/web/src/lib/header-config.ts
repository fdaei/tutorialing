import { publicApi } from '@/shared/services/api';
import { logWarning } from '@/shared/services/error-logger';
import { defaultLandingConfig, mediaReference, normalizeLandingConfig, type LandingConfig } from '@/features/landing';

type PublicSetting = { key: string; value: unknown; public: boolean };
type HeaderConfig = Pick<LandingConfig, 'brand' | 'header'>;

/**
 * Every route renders the same `Header`/`Footer` from components/layout/site,
 * but only the home page fetched the CMS-configured brand/nav server-side —
 * other pages rendered `<Header />` bare, so they fell back to
 * defaultLandingConfig and flashed nav skeletons instead of matching the
 * home page. This centralizes that fetch so all routes stay in sync.
 */
export async function resolveHeaderConfig(): Promise<HeaderConfig> {
  const settings = await publicApi<PublicSetting[]>('/support/public-settings').catch((error: unknown) => {
    logWarning(error, { scope: 'route', name: 'header-config:/support/public-settings' });
    return [] as PublicSetting[];
  });
  const landingSetting = settings.find((setting) => setting.key === 'landing.page')?.value;
  const themeSetting = settings.find((setting) => setting.key === 'theme.settings')?.value;
  const config = normalizeLandingConfig({
    ...((landingSetting && typeof landingSetting === 'object' ? landingSetting : {}) as Record<string, unknown>),
    theme: themeSetting,
  });
  const logoId = mediaReference(config.brand.logo);
  const logo = logoId
    ? await publicApi<{ url: string }>(`/files/public/${logoId}`)
        .then((result) => result.url || defaultLandingConfig.brand.logo)
        .catch((error: unknown) => {
          logWarning(error, { scope: 'route', name: `header-config:/files/public/${logoId}` });
          return defaultLandingConfig.brand.logo;
        })
    : config.brand.logo;
  return { brand: { ...config.brand, logo }, header: config.header };
}
