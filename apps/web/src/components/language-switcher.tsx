'use client';
import { Languages } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { localePath, type Locale } from '@/lib/i18n';
import { useTranslations } from './locale-provider';

export function LanguageSwitcher({ className='' }:{className?:string}) {
  const {locale,setLocale,t}=useTranslations(), pathname=usePathname(), query=useSearchParams(), router=useRouter();
  function change(next:Locale){
    if(next===locale)return;
    setLocale(next);
    document.documentElement.lang=next==='fa'?'fa-IR':'en';
    document.documentElement.dir=next==='fa'?'rtl':'ltr';
    document.cookie=`lingospeak_locale=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    const search=query.toString();
    if(sessionStorage.getItem('access_token')) api('/users/me/locale',{method:'PUT',body:JSON.stringify({locale:next})}).catch(()=>undefined);
    router.replace(`${localePath(pathname,next)}${search?`?${search}`:''}`);
  }
  return <label className={`inline-flex items-center gap-2 ${className}`} aria-label={t('language')}><Languages size={17}/><select value={locale} onChange={e=>change(e.target.value as Locale)} className="bg-transparent text-sm font-bold" aria-label={t('language')}><option value="fa">{t('persian')}</option><option value="en">{t('english')}</option></select></label>;
}
