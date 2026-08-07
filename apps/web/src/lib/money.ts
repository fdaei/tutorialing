import type { Locale } from './i18n';

/**
 * The single place money is turned into text.
 *
 * Canonical storage is **Toman** (see `AUDIT/01-financial.md` §1.2 — Rial exists
 * only inside `gateway.service.ts`, at the Zarinpal boundary). Both locales
 * therefore show the *same figure*: the platform prices in Toman and takes
 * payment in Iran, so an English-reading user is quoted exactly what a Persian
 * one is, only in Latin script and digits.
 *
 * This module exists because that was not true before. Eleven components each
 * hand-rolled `fa ? ' تومان' : ' IRR'` over the same integer, labelling a Toman
 * value as Rial for English readers and understating every price tenfold —
 * FIN-101. The worst case was the withdrawal form, which asked for an
 * "Amount (IRR)" while posting Toman.
 *
 * Keep it centralised: when money storage changes unit, exactly one function
 * changes rather than twelve.
 */

const LOCALE_TAG: Record<Locale, string> = { fa: 'fa-IR', en: 'en-US' };

/** Grouped digits only, in the locale's own numerals. No unit. */
export function formatNumber(value: number, locale: Locale) {
  return new Intl.NumberFormat(LOCALE_TAG[locale]).format(value);
}

/**
 * A money amount with its unit, e.g. `۵۰۰٬۰۰۰ تومان` / `500,000 Toman`.
 *
 * `Intl`'s `style: 'currency'` is deliberately not used: its only Iranian unit
 * is IRR (Rial), which would reintroduce FIN-101, and it has no notion of Toman.
 */
export function formatMoney(value: number, locale: Locale) {
  return `${formatNumber(value, locale)} ${locale === 'fa' ? 'تومان' : 'Toman'}`;
}

/** The unit on its own, for form labels like "Amount (Toman)". */
export function moneyUnit(locale: Locale) {
  return locale === 'fa' ? 'تومان' : 'Toman';
}

/** For optional amounts, where a missing value should read as an em dash. */
export function formatMoneyOrDash(value: number | null | undefined, locale: Locale) {
  return value == null ? '—' : formatMoney(value, locale);
}
