'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { type Locale, type MessageKey, translate } from '@/lib/i18n';

type LocaleState={locale:Locale;setLocale:(locale:Locale)=>void};
const LocaleContext = createContext<LocaleState>({locale:'fa',setLocale:()=>undefined});
export function LocaleProvider({ locale, children }:{ locale:Locale; children:React.ReactNode }) {
 const[current,setCurrent]=useState(locale);
 useEffect(()=>setCurrent(locale),[locale]);
 return <LocaleContext.Provider value={{locale:current,setLocale:setCurrent}}>{children}</LocaleContext.Provider>;
}
export function useLocale() { return useContext(LocaleContext); }
export function useTranslations() { const{locale,setLocale}=useLocale(); return { locale,setLocale,t:(key:MessageKey)=>translate(locale,key) }; }
