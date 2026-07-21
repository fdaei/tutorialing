import 'server-only';
import {headers} from 'next/headers';
import {isLocale,type Locale} from './i18n';

export async function requestLocale():Promise<Locale>{const value=(await headers()).get('x-lingospeak-locale');return isLocale(value)?value:'fa'}
