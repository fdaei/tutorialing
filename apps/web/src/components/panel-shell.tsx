'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {usePathname,useRouter} from 'next/navigation';
import {useQuery} from '@tanstack/react-query';
import {api,ApiError} from '@/lib/api';
import {Bell,BookOpen,CalendarDays,CreditCard,FileCheck,Grid2X2,HelpCircle,Home,LifeBuoy,LogOut,Menu,MessageCircle,Search,Settings,ShieldCheck,TicketCheck,Users,X} from 'lucide-react';
import {LanguageSwitcher} from './language-switcher';
import {useTranslations} from './locale-provider';
import {localePath} from '@/lib/i18n';

export type NavItem={href:string;label:string;labelEn:string;icon?:React.ElementType;roles?:string[];permission?:string};

export function PanelShell({title,items,children}:{title:string;items:NavItem[];children:React.ReactNode}){
 const router=useRouter(),path=usePathname(),[open,setOpen]=useState(false),{locale}=useTranslations(),fa=locale==='fa',p=(href:string)=>localePath(href,locale);
 const me=useQuery({queryKey:['panel-me'],queryFn:()=>api<{name?:string;roles:string[];permissions:string[]}>('/users/me'),retry:false});
 useEffect(()=>{if(me.error instanceof ApiError&&me.error.status===401)router.replace(`/auth?next=${encodeURIComponent(location.pathname)}`)},[me.error,router]);
 const adminMode=path.includes('/admin'),teacherMode=path.includes('/teacher-panel'),allowed=adminMode?['ADMIN','STAFF','SUPPORT','FINANCE','EXAMINER']:teacherMode?['TEACHER','ADMIN']:[];
 const roles=Array.isArray(me.data?.roles)?me.data.roles:[];
 const permissions=Array.isArray(me.data?.permissions)?me.data.permissions:[];
 const canSee=(item:NavItem)=>(!item.roles||item.roles.some(role=>roles.includes(role)))&&(!item.permission||permissions.includes(item.permission));
 const visibleItems=items.filter(canSee);
 const currentItem=[...items].sort((a,b)=>b.href.length-a.href.length).find(item=>{const href=p(item.href);return path===href||(item.href!=='/admin'&&item.href!=='/dashboard'&&item.href!=='/teacher-panel'&&path.startsWith(`${href}/`))});
 const primaryRole=roles.includes('ADMIN')?'ADMIN':roles.includes('STAFF')?'STAFF':roles.includes('SUPPORT')?'SUPPORT':roles.includes('FINANCE')?'FINANCE':roles.includes('EXAMINER')?'EXAMINER':roles.includes('TEACHER')?'TEACHER':'STUDENT';
 const roleLabels:Record<string,[string,string]>={
  ADMIN:['مدیر کل','Administrator'],STAFF:['کارشناس مدیریت','Staff'],SUPPORT:['پشتیبان','Support'],
  FINANCE:['کارشناس مالی','Finance'],EXAMINER:['ارزیاب آزمون','Examiner'],TEACHER:['مدرس','Teacher'],STUDENT:['زبان‌آموز','Student'],
 };
 const roleLabel:[string,string]=roleLabels[primaryRole]??['زبان‌آموز','Student'];
 const notificationItem=visibleItems.find(item=>item.href.endsWith('/notifications'));
 const showAdminSearch=adminMode&&roles.some(role=>['ADMIN','STAFF'].includes(role));
 if(me.isLoading)return <div className="skeleton min-h-screen"/>;
 if(me.data&&((allowed.length&&!roles.some(r=>allowed.includes(r)))||(currentItem&&!canSee(currentItem))))return <main className="grid min-h-screen place-items-center"><div className="panel-card p-10 text-center"><ShieldCheck className="mx-auto text-red-500"/><h1 className="mt-4 text-2xl font-black">{fa?'دسترسی مجاز نیست':'Access denied'}</h1><Link href={p('/panel')} className="mt-5 inline-block text-blue">{fa?'رفتن به پنل مجاز':'Open my workspace'}</Link></div></main>;

 const displayTitle=adminMode
  ? primaryRole==='SUPPORT'?(fa?'پنل پشتیبانی':'Support workspace')
   :primaryRole==='FINANCE'?(fa?'پنل مالی':'Finance workspace')
   :primaryRole==='EXAMINER'?(fa?'پنل ارزیابی آزمون':'Examiner workspace')
   :(fa?'مدیریت لینگواسپیک':'LingoSpeak administration')
  :teacherMode?(fa?'پنل مدرس':'Teacher panel'):(fa?'پنل زبان‌آموز':'Student dashboard');
 const Sidebar=()=> <aside className={`flex h-full flex-col p-4 ${adminMode?'bg-[#111b4a] text-white':'bg-white text-navy'}`}><Link href={p('/')} className="flex items-center gap-3 px-2 py-2"><span className={`grid size-11 place-items-center rounded-full ${adminMode?'bg-blue text-white':'brand-gradient text-white shadow-lg'}`}><MessageCircle size={22}/></span><span><strong className="latin block text-xl">LingoSpeak</strong><small className={adminMode?'text-white/50':'text-muted'}>{displayTitle}</small></span></Link><nav className="mt-8 grid gap-1.5">{visibleItems.map(item=>{const Icon=item.icon??Home,href=p(item.href);const active=path===href||(item.href!=='/admin'&&item.href!=='/dashboard'&&path.startsWith(href));return <Link onClick={()=>setOpen(false)} key={item.href} href={href} className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold ${active?(adminMode?'bg-gradient-to-l from-blue to-purple text-white shadow-lg':'bg-[#eef2ff] text-blue'):(adminMode?'text-white/65 hover:bg-white/10 hover:text-white':'text-muted hover:bg-[#f5f6fb] hover:text-navy')}`}><Icon size={19}/><span className="flex-1">{fa?item.label:item.labelEn}</span>{active&&<span className={`size-2 rounded-full ${adminMode?'bg-white':'bg-blue'}`}/>}</Link>})}</nav><button onClick={async()=>{await api('/auth/logout',{method:'POST'}).catch(()=>undefined);sessionStorage.removeItem('access_token');router.replace(p('/'))}} className={`mt-auto flex items-center gap-3 rounded-xl px-4 py-3 text-sm ${adminMode?'text-white/65 hover:bg-white/10':'text-red-500'}`}><LogOut size={18}/>{fa?'خروج از حساب':'Sign out'}</button></aside>;

 return <div className="min-h-screen bg-[#f8f9fd]"><div className={`fixed inset-y-0 z-30 hidden w-[252px] hairline lg:block ${fa?'right-0 border-l':'left-0 border-r'}`}><Sidebar/></div>{open&&<div className="fixed inset-0 z-50 bg-black/25 backdrop-blur-sm lg:hidden" onClick={()=>setOpen(false)}><div className="h-full w-[285px] max-w-[85vw]" onClick={e=>e.stopPropagation()}><button className={`absolute top-4 z-10 grid size-9 place-items-center rounded-full bg-white shadow ${fa?'left-4':'right-4'}`} onClick={()=>setOpen(false)} aria-label={fa?'بستن':'Close'}><X/></button><Sidebar/></div></div>}<main className={`min-w-0 ${fa?'lg:mr-[252px]':'lg:ml-[252px]'}`}><header className="sticky top-0 z-20 flex h-[76px] items-center gap-4 border-b hairline bg-white/95 px-5 backdrop-blur-xl md:px-8"><button className="lg:hidden" onClick={()=>setOpen(true)} aria-label={fa?'منو':'Menu'}><Menu/></button>{(!adminMode||showAdminSearch)&&<div className="hidden w-full max-w-lg items-center gap-2 rounded-xl border hairline bg-[#fafbfe] px-4 py-2.5 text-muted md:flex"><Search size={18}/><span className="text-sm">{adminMode?(fa?'جستجو در کاربران، آزمون‌ها و تیکت‌ها…':'Search users, tests, and tickets…'):(fa?'جستجو در کلاس‌ها، درس‌ها و مدرس‌ها…':'Search classes, lessons, and teachers…')}</span></div>}<div className={`${fa?'mr-auto':'ml-auto'} flex items-center gap-3`}><LanguageSwitcher className="rounded-xl border hairline px-2 py-1.5"/><button className="grid size-9 place-items-center text-muted" aria-label={fa?'راهنما':'Help'}><HelpCircle size={19}/></button>{notificationItem&&<Link href={p(notificationItem.href)} className="relative grid size-9 place-items-center" aria-label={fa?'اعلان‌ها':'Notifications'}><Bell size={20}/><span className="absolute right-1 top-1 size-2 rounded-full bg-purple ring-2 ring-white"/></Link>}<span className="mx-1 hidden h-9 w-px bg-[#e7e9f0] sm:block"/><div className={`hidden sm:block ${fa?'text-left':'text-right'}`}><strong className="block text-xs">{me.data?.name??roleLabel[fa?0:1]}</strong><small className="text-muted">{roleLabel[fa?0:1]}</small></div><span className="brand-gradient grid size-10 place-items-center rounded-full font-black text-white">{(me.data?.name??'L').slice(0,1)}</span></div></header><div className="mx-auto max-w-[1500px] p-4 sm:p-6 md:p-8"><div className="reveal">{children}</div></div></main></div>
}

export const studentNav:NavItem[]=[{href:'/dashboard',label:'داشبورد',labelEn:'Dashboard',icon:Grid2X2},{href:'/dashboard/plan',label:'برنامه یادگیری',labelEn:'Learning plan',icon:BookOpen},{href:'/dashboard/classes',label:'کلاس‌ها',labelEn:'Classes',icon:CalendarDays},{href:'/dashboard/matches',label:'مدرس‌ها',labelEn:'Teachers',icon:Users},{href:'/dashboard/tests',label:'آزمون‌ها',labelEn:'Tests',icon:FileCheck},{href:'/dashboard/tickets',label:'تیکت‌ها',labelEn:'Tickets',icon:LifeBuoy},{href:'/dashboard/wallet',label:'مالی',labelEn:'Payments',icon:CreditCard},{href:'/dashboard/profile',label:'تنظیمات',labelEn:'Settings',icon:Settings}];
export const teacherNav:NavItem[]=[
 {href:'/teacher-panel',label:'داشبورد',labelEn:'Dashboard',icon:Grid2X2},
 {href:'/teacher-panel/profile',label:'پروفایل عمومی',labelEn:'Public profile',icon:Users},
 {href:'/teacher-panel/verification',label:'مدارک و احراز هویت',labelEn:'Documents & verification',icon:FileCheck},
 {href:'/teacher-panel/video',label:'ویدیوی معرفی',labelEn:'Introduction video'},
 {href:'/teacher-panel/languages',label:'زبان‌های آموزشی',labelEn:'Teaching languages'},
 {href:'/teacher-panel/specialties',label:'تخصص‌ها و سطح‌ها',labelEn:'Specialties & levels'},
 {href:'/teacher-panel/pricing',label:'قیمت‌گذاری',labelEn:'Pricing',icon:CreditCard},
 {href:'/teacher-panel/availability',label:'برنامه هفتگی',labelEn:'Weekly schedule',icon:CalendarDays},
 {href:'/teacher-panel/calendar',label:'تقویم و مسدودی‌ها',labelEn:'Calendar & blocks',icon:CalendarDays},
 {href:'/teacher-panel/classes',label:'رزروها و کلاس‌ها',labelEn:'Bookings & classes',icon:BookOpen},
 {href:'/teacher-panel/students',label:'زبان‌آموزان',labelEn:'Students',icon:Users},
 {href:'/teacher-panel/plans',label:'تکالیف و برنامه‌ها',labelEn:'Assignments & plans'},
 {href:'/teacher-panel/tickets',label:'تیکت‌ها',labelEn:'Tickets',icon:LifeBuoy},
 {href:'/teacher-panel/earnings',label:'درآمد و تسویه',labelEn:'Earnings & payouts',icon:CreditCard},
 {href:'/teacher-panel/reviews',label:'نظرات و امتیازها',labelEn:'Reviews & ratings'},
 {href:'/teacher-panel/notifications',label:'اعلان‌ها',labelEn:'Notifications',icon:Bell},
 {href:'/teacher-panel/settings',label:'تنظیمات',labelEn:'Settings',icon:Settings}
];
export const adminNav:NavItem[]=[
 {href:'/admin',label:'داشبورد',labelEn:'Dashboard',icon:Grid2X2,roles:['ADMIN','STAFF']},
 {href:'/admin/search',label:'جستجوی سراسری',labelEn:'Global search',icon:Search,roles:['ADMIN','STAFF']},
 {href:'/admin/users',label:'کاربران',labelEn:'Users',icon:Users,roles:['ADMIN','STAFF'],permission:'users.read'},
 {href:'/admin/teachers',label:'مدرس‌ها',labelEn:'Teachers',icon:Users,roles:['ADMIN','STAFF'],permission:'teachers.verify'},
 {href:'/admin/teacher-applications',label:'درخواست‌های مدرس',labelEn:'Teacher applications',icon:FileCheck,roles:['ADMIN','STAFF'],permission:'teachers.verify'},
 {href:'/admin/teacher-documents',label:'مدارک مدرس',labelEn:'Teacher documents',icon:FileCheck,roles:['ADMIN','STAFF'],permission:'teachers.verify'},
 {href:'/admin/teacher-prices',label:'تأیید قیمت مدرس',labelEn:'Teacher price approvals',icon:CreditCard,roles:['ADMIN','STAFF','FINANCE'],permission:'teacher-prices.manage'},
 {href:'/admin/languages',label:'زبان‌ها',labelEn:'Languages',roles:['ADMIN','STAFF'],permission:'languages.manage'},
 {href:'/admin/tests',label:'آزمون‌ها',labelEn:'Tests',icon:BookOpen,roles:['ADMIN','STAFF'],permission:'tests.manage'},
 {href:'/admin/test-reviews',label:'تصحیح آزمون',labelEn:'Test reviews',icon:FileCheck,roles:['ADMIN','EXAMINER']},
 {href:'/admin/bookings',label:'رزروها',labelEn:'Bookings',icon:CalendarDays,roles:['ADMIN','STAFF'],permission:'bookings.read'},
 {href:'/admin/availability-blocks',label:'مسدودی‌های زمان',labelEn:'Availability blocks',icon:CalendarDays,roles:['ADMIN','STAFF'],permission:'availability.manage'},
 {href:'/admin/tickets',label:'تیکت‌ها',labelEn:'Tickets',icon:TicketCheck,roles:['ADMIN','STAFF','SUPPORT'],permission:'tickets.read'},
 {href:'/admin/finance',label:'امور مالی',labelEn:'Finance',icon:CreditCard,roles:['ADMIN','STAFF'],permission:'payments.read'},
 {href:'/admin/discounts',label:'کدهای تخفیف',labelEn:'Discounts',roles:['ADMIN','FINANCE'],permission:'payouts.manage'},
 {href:'/admin/refunds',label:'بازپرداخت‌ها',labelEn:'Refunds',roles:['ADMIN','FINANCE'],permission:'payments.refund'},
 {href:'/admin/teacher-earnings',label:'درآمد مدرس‌ها',labelEn:'Teacher earnings',roles:['ADMIN','STAFF'],permission:'reports.read'},
 {href:'/admin/payouts',label:'تسویه‌ها',labelEn:'Payouts',roles:['ADMIN','FINANCE'],permission:'payouts.manage'},
 {href:'/admin/reviews',label:'نظرات',labelEn:'Reviews',roles:['ADMIN','STAFF'],permission:'reviews.manage'},
 {href:'/admin/roles',label:'نقش‌ها و مجوزها',labelEn:'Roles & permissions',icon:ShieldCheck,roles:['ADMIN','STAFF'],permission:'roles.manage'},
 {href:'/admin/cms',label:'مدیریت محتوا',labelEn:'CMS',roles:['ADMIN','STAFF'],permission:'cms.manage'},
 {href:'/admin/notifications',label:'اعلان‌ها',labelEn:'Notifications',icon:Bell,roles:['ADMIN','STAFF'],permission:'notifications.read'},
 {href:'/admin/audit',label:'لاگ فعالیت',labelEn:'Audit logs',roles:['ADMIN','STAFF'],permission:'audit.read'},
 {href:'/admin/settings',label:'تنظیمات',labelEn:'Settings',icon:Settings,roles:['ADMIN','STAFF'],permission:'settings.manage'}
];
