'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Renders children into `document.body` so `position: fixed` overlays are not
 * clipped or re-anchored by an ancestor with transform, filter or overflow.
 */
export function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? createPortal(children, document.body) : null;
}
