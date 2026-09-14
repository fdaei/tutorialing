'use client';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from '@/components/shared/locale-provider';
import { formatNumber } from '@/lib/money';
import { cn } from './cn';

export function Pagination({
  page,
  pages,
  total,
  onChange,
  noun,
  className,
}: {
  page: number;
  pages: number;
  total?: number;
  onChange: (page: number) => void;
  noun?: { fa: string; en: string };
  className?: string;
}) {
  const { locale } = useTranslations();
  const english = locale === 'en';
  const safePages = Math.max(1, pages);
  const start = Math.max(1, Math.min(page - 2, safePages - 4));
  const visible = Array.from({ length: Math.min(5, safePages) }, (_, index) => start + index);
  // Chevrons point in the reading direction: "previous" is to the right in RTL.
  const Prev = english ? ChevronLeft : ChevronRight;
  const Next = english ? ChevronRight : ChevronLeft;
  const control = 'grid size-9 place-items-center rounded-lg text-sm font-bold transition disabled:opacity-30';
  return (
    <nav aria-label={english ? 'Pagination' : 'صفحه‌بندی'} className={cn('flex flex-wrap items-center justify-between gap-3', className)}>
      <p className="text-sm text-muted">
        {total != null &&
          `${formatNumber(total, locale)} ${noun ? noun[locale] : english ? 'results' : 'نتیجه'}`}
      </p>
      {safePages > 1 && (
        <div className="flex items-center gap-1">
          <button type="button" aria-label={english ? 'Previous page' : 'صفحه قبل'} disabled={page <= 1} onClick={() => onChange(page - 1)} className={cn(control, 'border border-line bg-white hover:bg-canvas')}>
            <Prev size={17} />
          </button>
          {visible.map((number) => (
            <button
              key={number}
              type="button"
              aria-current={number === page ? 'page' : undefined}
              onClick={() => onChange(number)}
              className={cn(control, number === page ? 'bg-ink text-white' : 'hidden border border-line bg-white hover:bg-canvas sm:grid')}
            >
              {formatNumber(number, locale)}
            </button>
          ))}
          <button type="button" aria-label={english ? 'Next page' : 'صفحه بعد'} disabled={page >= safePages} onClick={() => onChange(page + 1)} className={cn(control, 'border border-line bg-white hover:bg-canvas')}>
            <Next size={17} />
          </button>
        </div>
      )}
    </nav>
  );
}
