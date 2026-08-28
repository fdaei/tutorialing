'use client';

import { translate } from '@/lib/i18n';
import { ApiError, apiMessage } from '@/shared/services/api';
import type { Localized } from './types';

export function Status({ error, ok, fa }: { error: unknown; ok: boolean } & Localized) {
  if (error) {
    const fields = error instanceof ApiError ? Object.entries(error.details.fieldErrors ?? {}) : [];
    return (
      <div role="alert" className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
        <p className="font-black">{apiMessage(error, translate(fa, 'legacyTheOperationFailed'))}</p>
        {fields.length > 0 && (
          <ul className="mt-2 list-inside list-disc space-y-1">
            {fields.map(([field, message]) => (
              <li key={field}>
                <span className="font-bold">{field}:</span> {message}
              </li>
            ))}
          </ul>
        )}
        {error instanceof ApiError && error.details.requestId && (
          <p className="mt-2 text-xs text-red-700">
            {translate(fa, 'legacyRequestID')}:{' '}
            <span className="font-mono" dir="ltr">
              {error.details.requestId}
            </span>
          </p>
        )}
      </div>
    );
  }
  if (ok)
    return (
      <p role="status" className="mt-3 rounded-2xl bg-lavender p-3 text-sm font-bold text-purple">
        {translate(fa, 'legacySavedSuccessfully')}
      </p>
    );
  return null;
}

export function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-7 rounded-3xl border hairline bg-white p-5 shadow-soft">
      <h3 className="text-lg font-black">{title}</h3>
      {children}
    </section>
  );
}

export function Field({
  label,
  error,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold">{label}</span>
      <input
        {...props}
        aria-invalid={Boolean(error)}
        aria-describedby={error && `${props.name}-error`}
        className={`w-full rounded-2xl border px-4 py-3 outline-none transition focus:ring-4 ${error ? 'border-red-400 bg-red-50/30 focus:border-red-500 focus:ring-red-100' : 'hairline focus:border-purple focus:ring-violet/15'}`}
      />
      {error && (
        <span id={`${props.name}-error`} className="mt-1.5 block text-xs font-bold text-red-600">
          {error}
        </span>
      )}
    </label>
  );
}

export function Area({
  label,
  error,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold">{label}</span>
      <textarea
        {...props}
        aria-invalid={Boolean(error)}
        aria-describedby={error && `${props.name}-error`}
        className={`min-h-28 w-full rounded-2xl border px-4 py-3 outline-none transition focus:ring-4 ${error ? 'border-red-400 bg-red-50/30 focus:border-red-500 focus:ring-red-100' : 'hairline focus:border-purple focus:ring-violet/15'}`}
      />
      {error && (
        <span id={`${props.name}-error`} className="mt-1.5 block text-xs font-bold text-red-600">
          {error}
        </span>
      )}
    </label>
  );
}

export function Select({ label, name, children }: { label: string; name: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold">{label}</span>
      <select name={name} className="w-full rounded-2xl border hairline bg-white px-4 py-3">
        {children}
      </select>
    </label>
  );
}

export function Submit({ busy, fa, children }: { busy: boolean; children: React.ReactNode } & Localized) {
  return (
    <button
      disabled={busy}
      className="mt-4 rounded-full bg-gradient-to-r from-blue to-purple px-6 py-3 font-black text-white shadow-lg shadow-purple/15 transition hover:-translate-y-0.5 disabled:opacity-50"
    >
      {busy ? translate(fa, 'legacyWorking') : children}
    </button>
  );
}
