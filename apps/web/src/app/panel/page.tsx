'use client';

import{useEffect}from'react';
import{useRouter}from'next/navigation';
import{useQuery}from'@tanstack/react-query';
import{api,ApiError}from'@/lib/api';
import{useTranslations}from'@/components/locale-provider';
import{localePath}from'@/lib/i18n';
import{panelHome,type PanelIdentity}from'@/lib/panel-access';

export default function PanelRouter(){
  const router=useRouter(),{locale}=useTranslations(),p=(path:string)=>localePath(path,locale);
  const me=useQuery({queryKey:['panel-me'],queryFn:()=>api<PanelIdentity>('/users/me'),retry:false});
  useEffect(()=>{
    if(me.data)router.replace(p(panelHome(me.data)));
    else if(me.error instanceof ApiError&&me.error.status===401)router.replace(p('/auth?next=/panel'));
  },[me.data,me.error,router,locale]);
  return <main className="grid min-h-screen place-items-center bg-[#f7f8fc]"><div className="text-center"><span className="brand-gradient mx-auto block size-14 animate-pulse rounded-full"/><p className="mt-5 font-bold text-muted">{locale==='fa'?'در حال ورود به پنل مناسب…':'Opening your workspace…'}</p></div></main>;
}
