import { Suspense } from 'react';
import { LoginPage } from '@/features/auth/components/password-pages';

// LoginPage reads `?reset=success` via useSearchParams, which needs a Suspense
// boundary or the whole route opts out of static rendering at build time.
export default function Page() {
  return (
    <Suspense>
      <LoginPage />
    </Suspense>
  );
}
