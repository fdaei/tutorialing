'use client';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslations } from '@/components/shared/locale-provider';
import { useDebouncedValue } from '@/shared/hooks/use-debounced-value';
import { Button } from './button';
import { cn } from './cn';
import { Sheet } from './sheet';

export function FilterChip({
  active,
  onClick,
  count,
  children,
  className,
}: {
  active: boolean;
  onClick: () => void;
  count?: number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-bold transition',
        active
          ? 'border-primary bg-primary text-white'
          : 'border-[#d5dae6] bg-white text-ink hover:border-primary/50 hover:text-primary',
        className,
      )}
    >
      {children}
      {count != null && (
        <span className={cn('rounded-full px-1.5 text-xs', active ? 'bg-white/20' : 'bg-canvas text-muted')}>{count}</span>
      )}
    </button>
  );
}

/** A single-choice chip row. Scrolls horizontally on phones instead of wrapping into a wall of chips. */
export function ChipGroup<V extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: V;
  options: Array<{ value: V; label: React.ReactNode; count?: number }>;
  onChange: (value: V) => void;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cn('no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 py-0.5', className)}>
      {options.map((option) => (
        <FilterChip key={option.value} active={value === option.value} count={option.count} onClick={() => onChange(option.value)}>
          {option.label}
        </FilterChip>
      ))}
    </div>
  );
}

/** Search box that commits after the user pauses typing — no submit button needed. */
export function SearchField({
  value,
  onChange,
  placeholder,
  label,
  className,
  delay = 350,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label?: string;
  className?: string;
  delay?: number;
}) {
  const { locale } = useTranslations();
  const [draft, setDraft] = useState(value);
  const debounced = useDebouncedValue(draft, delay);
  useEffect(() => setDraft(value), [value]);
  useEffect(() => {
    if (debounced.trim() !== value) onChange(debounced.trim());
    // onChange identity is not stable across renders in callers; only react to typed input.
  }, [debounced]);
  return (
    <label className={cn('relative flex min-h-11 items-center', className)}>
      <span className="sr-only">{label ?? placeholder}</span>
      <Search size={17} aria-hidden="true" className="pointer-events-none absolute start-3.5 text-subtle" />
      <input
        type="search"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder={placeholder}
        className="input ps-10 pe-9 [&::-webkit-search-cancel-button]:hidden"
      />
      {draft && (
        <button
          type="button"
          onClick={() => {
            setDraft('');
            onChange('');
          }}
          aria-label={locale === 'en' ? 'Clear search' : 'پاک کردن جست‌وجو'}
          className="absolute end-2 grid size-7 place-items-center rounded-lg text-subtle hover:bg-canvas hover:text-ink"
        >
          <X size={15} />
        </button>
      )}
    </label>
  );
}

/**
 * Filters that sit inline from `md` up and collapse behind a "Filters (n)" button
 * that opens a bottom sheet on phones. Pass the same controls once; they render in
 * whichever container is visible.
 */
export function ResponsiveFilters({
  children,
  activeCount,
  onReset,
  resultLabel,
  className,
}: {
  children: React.ReactNode;
  activeCount: number;
  onReset?: () => void;
  resultLabel?: string;
  className?: string;
}) {
  const { locale } = useTranslations();
  const english = locale === 'en';
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className={cn('hidden flex-wrap items-end gap-3 md:flex', className)}>
        {children}
        {activeCount > 0 && onReset && (
          <Button variant="ghost" size="md" onClick={onReset} icon={<X size={16} />}>
            {english ? 'Clear filters' : 'پاک کردن فیلترها'}
          </Button>
        )}
      </div>
      <div className="md:hidden">
        <Button variant="secondary" onClick={() => setOpen(true)} icon={<SlidersHorizontal size={16} />}>
          {english ? 'Filters' : 'فیلترها'}
          {activeCount > 0 && <span className="grid size-5 place-items-center rounded-full bg-primary text-[11px] text-white">{activeCount}</span>}
        </Button>
      </div>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={english ? 'Filters' : 'فیلترها'}
        footer={
          <div className="flex gap-2">
            {onReset && (
              <Button variant="ghost" onClick={onReset} disabled={!activeCount}>
                {english ? 'Clear' : 'پاک کردن'}
              </Button>
            )}
            <Button block onClick={() => setOpen(false)}>
              {resultLabel ?? (english ? 'Show results' : 'نمایش نتایج')}
            </Button>
          </div>
        }
      >
        <div className="grid gap-5 [&_select]:w-full">{children}</div>
      </Sheet>
    </>
  );
}

export function FilterLabel({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('grid min-w-0 gap-1.5', className)}>
      <span className="text-xs font-bold text-muted">{label}</span>
      {children}
    </div>
  );
}
