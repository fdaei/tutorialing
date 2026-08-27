'use client';
import { useEffect } from 'react';
import { webConfig } from '@/config';

export function GoogleAnalytics() {
  useEffect(() => {
    fetch(`${webConfig.apiUrl}/support/public-settings`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: Array<{ key?: string; value?: unknown }>) => {
        const raw = rows.find((row) => row.key === 'analytics.googleMeasurementId')?.value;
        const id = typeof raw === 'string' ? raw : typeof raw === 'object' && raw && 'value' in raw ? String((raw as { value: unknown }).value) : '';
        if (!/^G-[A-Z0-9]+$/i.test(id) || document.querySelector(`script[data-ga="${id}"]`)) return;
        window.dataLayer = window.dataLayer || [];
        window.gtag = (...args: unknown[]) => window.dataLayer.push(args);
        window.gtag('js', new Date());
        window.gtag('config', id);
        const script = document.createElement('script');
        script.async = true; script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`; script.dataset.ga = id;
        document.head.appendChild(script);
      }).catch(() => undefined);
  }, []);
  return null;
}
declare global { interface Window { dataLayer: unknown[]; gtag: (...args: unknown[]) => void; } }
