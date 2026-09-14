'use client';
import { useTranslations } from '@/components/shared/locale-provider';
import { statusLabel, statusTone, type StatusTone } from '@/lib/status';
import { cn } from './cn';

const tones: Record<StatusTone, string> = {
  neutral: 'bg-[#f1f3f8] text-[#454d63]',
  info: 'bg-info-soft text-info',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  accent: 'bg-lavender text-purple',
};
const dots: Record<StatusTone, string> = {
  neutral: 'bg-[#8a91a5]',
  info: 'bg-info',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  accent: 'bg-purple',
};

export function Badge({
  tone = 'neutral',
  dot,
  className,
  children,
}: {
  tone?: StatusTone;
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold leading-5',
        tones[tone],
        className,
      )}
    >
      {dot && <span aria-hidden="true" className={cn('size-1.5 rounded-full', dots[tone])} />}
      {children}
    </span>
  );
}

/** A backend status enum rendered with its localized label and semantic colour. */
export function StatusBadge({ value, className }: { value: string | null | undefined; className?: string }) {
  const { locale } = useTranslations();
  return (
    <Badge tone={statusTone(value)} dot className={className}>
      {statusLabel(value, locale)}
    </Badge>
  );
}
