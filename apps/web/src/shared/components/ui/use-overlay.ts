'use client';
import { useEffect, useRef } from 'react';

/**
 * Shared open/close behavior for floating panels (Sheet, Drawer, ConfirmDialog):
 * focuses the panel on open, closes on Escape, locks page scroll, and restores
 * focus to the previously focused element on close.
 */
export function useOverlay<T extends HTMLElement>(open: boolean, onOpenChange: (open: boolean) => void) {
  const panel = useRef<T>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const body = document.body;
    const previousOverflow = body.style.overflow;
    const previousPaddingInlineEnd = body.style.paddingInlineEnd;
    // Compensates for the scrollbar disappearing under `overflow: hidden`, which
    // otherwise shifts page content sideways for the duration the panel is open.
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    const currentPaddingInlineEnd = Number.parseFloat(window.getComputedStyle(body).paddingInlineEnd) || 0;
    body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) body.style.paddingInlineEnd = `${currentPaddingInlineEnd + scrollbarWidth}px`;
    panel.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onOpenChange(false);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      body.style.overflow = previousOverflow;
      body.style.paddingInlineEnd = previousPaddingInlineEnd;
      previous?.focus?.();
    };
  }, [open, onOpenChange]);
  return panel;
}
