'use client';

import { useEffect } from 'react';
import { logError } from '@/shared/services/error-logger';
import { ErrorFallback } from './error-fallback';

export function RouteErrorFallback({ error, reset, name }: { error: Error & { digest?: string }; reset: () => void; name: string }) {
  useEffect(() => logError(error, { scope: 'route', name }), [error, name]);
  return <ErrorFallback onRetry={reset} title="این صفحه با خطا روبه‌رو شد" />;
}
