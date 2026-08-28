'use client';

import { RouteErrorFallback } from '@/shared/components/error-boundaries';

export default function AppRouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteErrorFallback error={error} reset={reset} name="root-route" />;
}
