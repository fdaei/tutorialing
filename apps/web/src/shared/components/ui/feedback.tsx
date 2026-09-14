'use client';
import { AlertTriangle, Inbox, RotateCcw } from 'lucide-react';
import { useTranslations } from '@/components/shared/locale-provider';
import { apiMessage } from '@/shared/services/api';
import { cn } from './cn';

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('skeleton rounded-xl', className)} />;
}

/** A labelled loading region so screen readers announce progress instead of silence. */
export function LoadingState({ rows = 3, className }: { rows?: number; className?: string }) {
  const { locale } = useTranslations();
  return (
    <div role="status" aria-label={locale === 'en' ? 'Loading' : 'در حال بارگذاری'} className={cn('grid gap-3', className)}>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-16" />
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  compact,
  className,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'grid justify-items-center rounded-2xl border border-dashed border-[#d5dae6] bg-white text-center',
        compact ? 'gap-2 px-4 py-8' : 'gap-3 px-6 py-12',
        className,
      )}
    >
      <span className="grid size-12 place-items-center rounded-2xl bg-primary-soft text-primary">{icon ?? <Inbox size={22} />}</span>
      <h3 className="font-black text-ink">{title}</h3>
      {description && <p className="max-w-md text-sm leading-7 text-muted">{description}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

export function ErrorState({
  error,
  fallback,
  onRetry,
  className,
}: {
  error?: unknown;
  fallback?: string;
  onRetry?: () => void;
  className?: string;
}) {
  const { locale } = useTranslations();
  const english = locale === 'en';
  const message = apiMessage(error, fallback ?? (english ? 'Could not load this data.' : 'دریافت اطلاعات انجام نشد.'));
  return (
    <div role="alert" className={cn('flex flex-wrap items-center gap-3 rounded-2xl border border-red-100 bg-danger-soft p-4 text-sm text-danger', className)}>
      <AlertTriangle size={18} aria-hidden="true" className="shrink-0" />
      <p className="min-w-0 flex-1 font-medium">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 font-bold hover:bg-red-100">
          <RotateCcw size={15} aria-hidden="true" />
          {english ? 'Try again' : 'تلاش دوباره'}
        </button>
      )}
    </div>
  );
}
