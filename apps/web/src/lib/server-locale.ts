import 'server-only';
import { headers } from 'next/headers';
import { resolveLocale, type Locale } from './i18n';

export async function requestLocale(): Promise<Locale> {
  const value = (await headers()).get('x-lingospeak-locale');
  return resolveLocale(value);
}
