'use client';

import Script from 'next/script';
import { useCallback, useEffect, useRef, useState } from 'react';
import { webConfig } from '@/config';

type GoogleIdentityServices = {
  accounts: {
    id: {
      initialize(options: { client_id: string; callback: (response: { credential: string }) => void }): void;
      renderButton(element: HTMLElement, options: Record<string, string | number>): void;
    };
  };
};

/** Reads the GIS global without re-declaring the `Window` augmentation that app/auth/page.tsx already owns. */
function gis(): GoogleIdentityServices | undefined {
  return (globalThis as { google?: GoogleIdentityServices }).google;
}

/**
 * Google sign-in that keeps the design system's outline button.
 *
 * Google Identity Services will only start the flow from a button it rendered
 * itself, and that button cannot be restyled. So the real one is rendered on top
 * at zero opacity and takes the click, while the styled button underneath is
 * what the user sees. The overlay is `aria-hidden` and the visible button stays
 * a real focusable control, so keyboard and screen-reader users get the labelled
 * button rather than Google's iframe.
 */
export function GoogleAuthButton({
  label,
  onCredential,
  onError,
  disabled,
}: {
  label: string;
  onCredential: (credential: string) => void;
  onError: (message: string) => void;
  disabled?: boolean;
}) {
  const host = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);
  const configured = Boolean(webConfig.googleClientId);
  // Kept in a ref so re-renders never re-initialize GIS with a stale callback.
  const handler = useRef(onCredential);
  handler.current = onCredential;

  const initialize = useCallback(() => {
    const google = gis();
    if (!configured || !google || !host.current) return;
    google.accounts.id.initialize({
      client_id: webConfig.googleClientId,
      callback: ({ credential }) => handler.current(credential),
    });
    host.current.replaceChildren();
    google.accounts.id.renderButton(host.current, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      shape: 'rectangular',
      text: 'continue_with',
      width: 400,
      locale: 'fa',
    });
    setReady(true);
  }, [configured]);

  useEffect(() => {
    if (gis()) initialize();
  }, [initialize]);

  return (
    <>
      {configured && (
        <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={initialize} />
      )}
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            if (!configured) onError('ورود با گوگل هنوز تنظیم نشده است.');
            else if (!ready) onError('سرویس گوگل هنوز آماده نشده است. لحظه‌ای بعد دوباره تلاش کنید.');
          }}
          className="relative flex min-h-14 w-full items-center justify-center rounded-[14px] border border-[#dce1eb] bg-white px-14 font-bold text-[#28324d] transition hover:border-[#c9c3f2] hover:bg-[#faf9ff] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#6257db]/15 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span aria-hidden className="absolute right-5">
            <svg width="22" height="22" viewBox="0 0 48 48" role="presentation">
              <path
                fill="#4285F4"
                d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
              />
              <path
                fill="#34A853"
                d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
              />
              <path
                fill="#FBBC05"
                d="M11.69 28.18c-.44-1.32-.69-2.73-.69-4.18s.25-2.86.69-4.18v-5.7H4.34A21.99 21.99 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"
              />
              <path
                fill="#EA4335"
                d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
              />
            </svg>
          </span>
          {label}
        </button>
        {configured && (
          <div
            ref={host}
            aria-hidden
            className={`absolute inset-0 overflow-hidden opacity-0 ${ready && !disabled ? '' : 'pointer-events-none'}`}
          />
        )}
      </div>
    </>
  );
}
