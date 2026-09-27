'use client';
import { X } from 'lucide-react';
import { useId } from 'react';
import { cn } from './cn';
import { Portal } from './portal';
import { useOverlay } from './use-overlay';

/**
 * Wide, full-height panel anchored to the inline-end edge — for detail views
 * and large edit forms. Closes on Escape and backdrop click, locks page
 * scroll and moves focus into the panel. Use `Sheet` instead for short forms
 * or confirmations.
 */
export function Drawer({
  open,
  onOpenChange,
  title,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const titleId = useId();
  const panel = useOverlay<HTMLElement>(open, onOpenChange);
  if (!open) return null;
  const close = () => onOpenChange(false);
  return (
    <Portal>
      <div className="fixed inset-0 z-[80] bg-ink/35 p-3 backdrop-blur-sm" onClick={close}>
        <aside
          ref={panel}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          onClick={(event) => event.stopPropagation()}
          className={cn(
            'ms-auto flex h-full w-full max-w-3xl flex-col overflow-y-auto rounded-s-[28px] bg-[#f8f9fd] p-5 shadow-2xl outline-none md:p-7',
            className,
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <h2 id={titleId} className="text-2xl font-black">
              {title}
            </h2>
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="grid size-10 shrink-0 place-items-center rounded-full border hairline bg-white"
            >
              <X />
            </button>
          </div>
          <div className="mt-5">{children}</div>
        </aside>
      </div>
    </Portal>
  );
}
