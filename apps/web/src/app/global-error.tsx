'use client';

import { RouteErrorFallback } from '@/shared/components/error-boundaries';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="fa" dir="rtl">
      <body>
        <RouteErrorFallback error={error} reset={reset} name="root-layout" />
      </body>
    </html>
  );
}
