'use client';

import { Footer, Header } from '@/components/layout/site';
import { RouteErrorFallback } from '@/shared/components/error-boundaries';

export default function CoursesError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <>
      <Header />
      <main className="page-shell section-space min-h-[60vh]">
        <RouteErrorFallback error={error} reset={reset} name="courses-route" />
      </main>
      <Footer />
    </>
  );
}
