'use client';
import { RouteErrorFallback } from '@/shared/components/error-boundaries';
export default function TeacherPanelError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteErrorFallback error={error} reset={reset} name="teacher-panel" />;
}
