'use client';

import Link from 'next/link';
import {useQuery} from '@tanstack/react-query';
import {ArrowLeft,ArrowRight,CalendarClock,CheckCircle2,CircleDollarSign,Clock3,FileCheck2,Users} from 'lucide-react';
import {api} from '@/lib/api';
import {localePath} from '@/lib/i18n';
import {useTranslations} from './locale-provider';
import {formatMoney,formatNumber} from '@/lib/money';

type Row=Record<string,unknown>;
type Finance={earnings?:{netAmount:number;status:string}[]};
type Application={status?:string;verificationItems?:{status:string}[]};
const rows=(value:unknown):Row[]=>Array.isArray(value)?value as Row[]:value&&typeof value==='object'&&Array.isArray((value as {data?:unknown}).data)?(value as {data:Row[]}).data:[];

export function TeacherDashboard(){
 const{locale}=useTranslations(),fa=locale==='fa',p=(href:string)=>localePath(href,locale),Arrow=fa?ArrowLeft:ArrowRight;
 const bookings=useQuery({queryKey:['/bookings/me'],queryFn:()=>api<unknown>('/bookings/me')});
 const finance=useQuery({queryKey:['/teacher/finance'],queryFn:()=>api<Finance>('/teacher/finance')});
 const application=useQuery({queryKey:['/teacher/application'],queryFn:()=>api<Application>('/teacher/application')});
 const all=rows(bookings.data),now=Date.now(),upcoming=all.filter(item=>new Date(String(item.startsAt)).getTime()>=now&&!['CANCELLED','COMPLETED'].includes(String(item.status))).sort((a,b)=>new Date(String(a.startsAt)).getTime()-new Date(String(b.startsAt)).getTime());
 const completed=all.filter(item=>item.status==='COMPLETED').length,students=new Set(all.map(item=>String(item.studentId??'')).filter(Boolean)).size;
 const balance=(finance.data?.earnings??[]).filter(item=>item.status!=='PAID').reduce((sum,item)=>sum+item.netAmount,0);
 const verified=application.data?.status==='APPROVED',docs=(application.data?.verificationItems??[]).filter(item=>item.status==='APPROVED').length;
 const number=(value:number)=>formatNumber(value,fa?'fa':'en'),money=(value:number)=>formatMoney(value,fa?'fa':'en');
 return <div className="teacher-workspace">
  <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="mb-2 text-sm font-bold text-blue">{fa?'مرکز کار مدرس':'Teacher workspace'}</p><h1 className="text-3xl font-black md:text-4xl">{fa?'سلام، امروز چه خبر؟':'Here’s your teaching day'}</h1><p className="mt-2 text-muted">{fa?'کلاس بعدی، کارهای ضروری و وضعیت درآمدت یک‌جا هستند.':'Your next class, essential tasks, and earnings in one place.'}</p></div><Link href={p('/teacher-panel/availability')} className="secondary-button"><CalendarClock size={18}/>{fa?'مدیریت برنامه':'Manage schedule'}</Link></header>
  <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
   <Stat icon={CalendarClock} label={fa?'کلاس‌های پیش رو':'Upcoming classes'} value={number(upcoming.length)} tone="blue"/>
   <Stat icon={CheckCircle2} label={fa?'کلاس‌های برگزارشده':'Completed classes'} value={number(completed)} tone="green"/>
   <Stat icon={Users} label={fa?'زبان‌آموزان':'Students'} value={number(students)} tone="purple"/>
   <Stat icon={CircleDollarSign} label={fa?'قابل تسویه':'Available balance'} value={money(balance)} tone="orange"/>
  </section>
  <div className="mt-5 grid gap-5 xl:grid-cols-[1.55fr_.85fr]">
   <section className="panel-card p-5 md:p-6"><div className="flex items-center justify-between"><div><h2 className="text-xl font-black">{fa?'کلاس بعدی':'Next class'}</h2><p className="mt-1 text-sm text-muted">{fa?'اطلاعاتی که برای شروع نیاز داری':'Everything you need to get started'}</p></div><Link href={p('/teacher-panel/classes')} className="text-sm font-bold text-blue">{fa?'همه کلاس‌ها':'All classes'}</Link></div>{bookings.isLoading?<div className="skeleton mt-6 h-44 rounded-2xl"/>:upcoming[0]?<NextClass item={upcoming[0]} fa={fa}/>:<Empty icon={CalendarClock} title={fa?'کلاس نزدیکی نداری':'No upcoming class'} text={fa?'برنامه هفتگی‌ات را بازبینی کن تا زمان‌های رزرو فعال باشند.':'Review your schedule to keep bookable times open.'}/>}</section>
   <section className="panel-card p-5 md:p-6"><h2 className="text-xl font-black">{fa?'کارهای ضروری':'Action required'}</h2><p className="mt-1 text-sm text-muted">{fa?'مواردی که روی دیده‌شدن پروفایل اثر دارند':'Items affecting your profile visibility'}</p><div className="mt-5 grid gap-3"><Task done={verified} title={fa?'تأیید حساب مدرس':'Teacher verification'} detail={verified?(fa?'حساب شما تأیید شده':'Your account is verified'):(fa?`${number(docs)} مدرک تأیید شده`:`${docs} approved documents`)} href={p('/teacher-panel/profile')} fa={fa}/><Task done={Boolean(upcoming.length)} title={fa?'برنامه قابل رزرو':'Bookable schedule'} detail={upcoming.length?(fa?'برنامه شما فعال است':'Your schedule is active'):(fa?'زمان تدریس اضافه کن':'Add teaching hours')} href={p('/teacher-panel/availability')} fa={fa}/></div></section>
  </div>
  <section className="mt-5 panel-card p-5 md:p-6"><div className="flex items-center justify-between"><div><h2 className="text-xl font-black">{fa?'دسترسی سریع':'Quick actions'}</h2><p className="mt-1 text-sm text-muted">{fa?'کارهای پرتکرار، بدون گشتن در منو':'Frequent tasks without digging through menus'}</p></div></div><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Quick href={p('/teacher-panel/classes')} icon={CheckCircle2} text={fa?'ثبت حضور کلاس':'Record attendance'} Arrow={Arrow}/><Quick href={p('/teacher-panel/plans')} icon={FileCheck2} text={fa?'تعریف تکلیف':'Create assignment'} Arrow={Arrow}/><Quick href={p('/teacher-panel/availability')} icon={Clock3} text={fa?'مسدود کردن زمان':'Block a time'} Arrow={Arrow}/><Quick href={p('/teacher-panel/earnings')} icon={CircleDollarSign} text={fa?'مشاهده مالی':'View finances'} Arrow={Arrow}/></div></section>
 </div>;
}

function Stat({icon:Icon,label,value,tone}:{icon:React.ElementType;label:string;value:string;tone:string}){return <article className="panel-card flex items-center gap-4 p-5"><span className={`teacher-stat-icon teacher-stat-${tone}`}><Icon size={22}/></span><div><p className="text-sm text-muted">{label}</p><strong className="mt-1 block text-2xl font-black">{value}</strong></div></article>}
function NextClass({item,fa}:{item:Row;fa:boolean}){const start=new Date(String(item.startsAt)),end=new Date(String(item.endsAt)),student=item.student&&typeof item.student==='object'?item.student as Row:{};return <div className="mt-6 rounded-2xl bg-[#f5f7ff] p-5"><div className="flex flex-wrap items-center justify-between gap-4"><div><span className="status-pill status-info">{String(item.type)==='trial'?(fa?'آزمایشی':'Trial'):(fa?'کلاس عادی':'Regular')}</span><h3 className="mt-3 text-xl font-black">{String(student.name??(fa?'زبان‌آموز':'Student'))}</h3><p className="mt-1 text-sm text-muted">{new Intl.DateTimeFormat(fa?'fa-IR':'en-US',{weekday:'long',month:'long',day:'numeric'}).format(start)}</p></div><div className="rounded-2xl bg-white px-6 py-4 text-center shadow-sm"><strong className="latin text-2xl">{start.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}</strong><p className="mt-1 text-xs text-muted">{Math.max(0,Math.round((end.getTime()-start.getTime())/60000))} {fa?'دقیقه':'min'}</p></div></div></div>}
function Empty({icon:Icon,title,text}:{icon:React.ElementType;title:string;text:string}){return <div className="mt-6 grid min-h-40 place-items-center rounded-2xl border border-dashed hairline text-center"><div><Icon className="mx-auto text-muted"/><strong className="mt-3 block">{title}</strong><p className="mt-1 text-sm text-muted">{text}</p></div></div>}
function Task({done,title,detail,href,fa}:{done:boolean;title:string;detail:string;href:string;fa:boolean}){return <Link href={href} className="flex items-center gap-3 rounded-2xl border hairline p-4 hover:border-indigo-200 hover:bg-indigo-50/40"><span className={`grid size-9 place-items-center rounded-full ${done?'bg-emerald-50 text-emerald-600':'bg-amber-50 text-amber-600'}`}>{done?<CheckCircle2 size={19}/>:<Clock3 size={19}/>}</span><span className="flex-1"><strong className="block text-sm">{title}</strong><small className="text-muted">{detail}</small></span><span className="text-xs font-bold text-blue">{fa?'بررسی':'Review'}</span></Link>}
function Quick({href,icon:Icon,text,Arrow}:{href:string;icon:React.ElementType;text:string;Arrow:React.ElementType}){return <Link href={href} className="flex items-center gap-3 rounded-2xl bg-[#f7f8fc] p-4 font-bold hover:bg-[#eef2ff] hover:text-blue"><Icon size={19}/><span className="flex-1">{text}</span><Arrow size={16}/></Link>}
