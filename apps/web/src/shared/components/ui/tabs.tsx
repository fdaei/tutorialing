'use client';
import { cn } from './cn';

/** Underlined status tabs with optional counts — the primary filter on queue-style admin screens. */
export function Tabs<V extends string>({
  value,
  onChange,
  items,
  label,
  className,
}: {
  value: V;
  onChange: (value: V) => void;
  items: Array<{ value: V; label: React.ReactNode; count?: number }>;
  label: string;
  className?: string;
}) {
  return (
    <div role="tablist" aria-label={label} className={cn('no-scrollbar flex gap-1 overflow-x-auto border-b border-line', className)}>
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              '-mb-px inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-bold transition',
              active ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-ink',
            )}
          >
            {item.label}
            {item.count != null && (
              <span className={cn('rounded-full px-2 text-xs leading-5', active ? 'bg-primary-soft text-primary' : 'bg-canvas text-muted')}>
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
