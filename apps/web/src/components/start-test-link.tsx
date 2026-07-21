'use client';

import Link from 'next/link';
import {useQuery} from '@tanstack/react-query';
import {api} from '@/lib/api';
import {localePath} from '@/lib/i18n';
import {useTranslations} from './locale-provider';

export function StartTestLink(){
 const{locale}=useTranslations(),fa=locale==='fa',me=useQuery({queryKey:['start-test-me'],queryFn:()=>api('/users/me'),retry:false});
 const direct=localePath('/test/device-check',locale),href=me.data?direct:localePath(`/auth?next=${direct}`,locale);
 if(me.isLoading)return <span className="brand-gradient cursor-wait rounded-xl px-7 py-4 font-black text-white opacity-60">{fa?'بررسی حساب…':'Checking account…'}</span>;
 return <Link href={href} className="brand-gradient rounded-xl px-7 py-4 font-black text-white">{me.data?(fa?'شروع آزمون':'Start test'):(fa?'ورود و شروع آزمون':'Sign in and start')}</Link>;
}
