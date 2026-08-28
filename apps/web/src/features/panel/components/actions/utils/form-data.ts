import { localized } from '@/lib/i18n';

export const tr = (fa: boolean, persian: string, english: string) => localized({ fa: persian, en: english }, fa);
export const value = (form: FormData, key: string) => String(form.get(key) ?? '').trim();
export const numeric = (form: FormData, key: string, fallback = 0) => {
  const out = Number(form.get(key));
  return Number.isFinite(out) ? out : fallback;
};
export const list = (form: FormData, key: string) =>
  value(form, key)
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
