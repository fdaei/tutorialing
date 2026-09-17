'use client';

import { useQuery } from '@tanstack/react-query';
import { defaultLandingConfig, normalizeLandingConfig, type LandingConfig } from '@/features/landing';
import { publicApi } from '@/shared/services/api';

export const PUBLIC_NAVIGATION_QUERY_KEY = ['public-navigation'] as const;
export type NavigationItem = LandingConfig['header']['nav'][number];

type PublicNavigationResponse = {
  items: unknown[] | null;
};

function normalizeNavigation(response: PublicNavigationResponse | undefined): NavigationItem[] | null {
  if (!response || !Array.isArray(response.items)) return null;
  return normalizeLandingConfig({ header: { nav: response.items } }).header.nav;
}

/**
 * The public shell reads the same published menu that the website builder
 * edits. An empty array is intentional; only a missing or failed response
 * falls back to the shipped menu.
 */
export function usePublicNavigation() {
  const query = useQuery({
    queryKey: PUBLIC_NAVIGATION_QUERY_KEY,
    queryFn: () => publicApi<PublicNavigationResponse>('/support/navigation', { cache: 'no-store' }),
    staleTime: 0,
    refetchOnMount: 'always',
  });
  const configured = normalizeNavigation(query.data);
  // `items: null` means no landing-page setting has been published yet. That is
  // different from an intentionally published empty array, so keep the shipped
  // navigation visible on fresh databases and after a failed request.
  const items = configured ?? defaultLandingConfig.header.nav;
  return { ...query, items };
}
