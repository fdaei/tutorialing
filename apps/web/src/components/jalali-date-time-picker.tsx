'use client';

import {useEffect,useMemo,useRef,useState} from 'react';
import {CalendarDays,ChevronLeft,ChevronRight,Clock,X} from 'lucide-react';
import {useTranslations} from './locale-provider';

type Props={value:Date|null;onChange:(date:Date|null)=>void;withTime?:boolean;minDate?:Date;placeholder?:string;disabled?:boolean;className?:string;name?:string};
type Jalali={jy:number;jm:number;jd:number};

const faMonths=['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
const enMonths=['Farvardin','Ordibehesht','Khordad','Tir','Mordad','Shahrivar','Mehr','Aban','Azar','Dey','Bahman','Esfand'];
const faWeek=['ش','ی','د','س','چ','پ','ج'];
const enWeek=['Sat','Sun','Mon','Tue','Wed','Thu','Fri'];

export function JalaliDateTimePicker({value,onChange,withTime=true,minDate=new Date(),placeholder,disabled,className='',name}:Props){
 const {locale}=useTranslations(),fa=locale==='fa',root=useRef<HTMLDivElement>(null),today=startOfDay(new Date());
 const selected=value??null,initial=toJalali(selected??new Date());
 const [open,setOpen]=useState(false),[view,setView]=useState({jy:initial.jy,jm:initial.jm}),[hour,setHour]=useState(String(selected?.getHours()??9).padStart(2,'0')),[minute,setMinute]=useState(String(selected?.getMinutes()??0).padStart(2,'0'));
 useEffect(()=>{if(!value)return;const next=toJalali(value);setView({jy:next.jy,jm:next.jm});setHour(String(value.getHours()).padStart(2,'0'));setMinute(String(value.getMinutes()).padStart(2,'0'))},[value]);
 useEffect(()=>{const close=(event:MouseEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false)};document.addEventListener('mousedown',close);return()=>document.removeEventListener('mousedown',close)},[]);
 const days=useMemo(()=>monthGrid(view.jy,view.jm),[view]);
 const selectedJ=selected?toJalali(selected):null;
 const min=startOfDay(minDate);
 const label=selected?new Intl.DateTimeFormat(fa?'fa-IR-u-ca-persian':'en-US-u-ca-persian',{year:'numeric',month:'long',day:'numeric',weekday:'short',...(withTime?{hour:'2-digit',minute:'2-digit'}:{})}).format(selected):'';
 function move(delta:number){setView(current=>{let jm=current.jm+delta,jy=current.jy;if(jm<1){jm=12;jy--}if(jm>12){jm=1;jy++}return{jy,jm}})}
 function pick(jd:number){const g=toGregorian(view.jy,view.jm,jd),next=new Date(g.gy,g.gm-1,g.gd,withTime?clampHour(hour):12,withTime?clampMinute(minute):0,0,0);if(startOfDay(next)<min)return;onChange(next);if(!withTime)setOpen(false)}
 function applyTime(){if(!selectedJ){pick(Math.max(1,toJalali(new Date()).jd));return}const g=toGregorian(selectedJ.jy,selectedJ.jm,selectedJ.jd),next=new Date(g.gy,g.gm-1,g.gd,clampHour(hour),clampMinute(minute),0,0);if(startOfDay(next)>=min)onChange(next);setOpen(false)}
 return <div ref={root} className={`relative ${className}`} dir={fa?'rtl':'ltr'}>{name&&<input type="hidden" name={name} value={selected?.toISOString()??''}/>}<button type="button" disabled={disabled} onClick={()=>setOpen(v=>!v)} aria-haspopup="dialog" aria-expanded={open} className="input flex w-full items-center gap-3 text-start disabled:opacity-50"><CalendarDays size={18} className="text-purple"/><span className={`min-w-0 flex-1 truncate ${label?'font-bold':'text-muted'}`}>{label||placeholder||(fa?'انتخاب تاریخ و ساعت':'Select date and time')}</span>{selected&&<span role="button" tabIndex={0} aria-label={fa?'پاک کردن':'Clear'} onClick={event=>{event.stopPropagation();onChange(null)}} className="grid size-7 place-items-center rounded-lg hover:bg-black/5"><X size={15}/></span>}</button>{open&&<div role="dialog" aria-label={fa?'تقویم شمسی':'Jalali calendar'} className="absolute z-[80] mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-3xl border hairline bg-white p-4 shadow-2xl"><div className="flex items-center justify-between"><button type="button" onClick={()=>move(fa?1:-1)} aria-label={fa?'ماه قبل':'Previous month'} className="grid size-10 place-items-center rounded-xl hover:bg-[#f3f4f8]">{fa?<ChevronRight/>:<ChevronLeft/>}</button><strong>{(fa?faMonths:enMonths)[view.jm-1]} {new Intl.NumberFormat(fa?'fa-IR':'en-US',{useGrouping:false}).format(view.jy)}</strong><button type="button" onClick={()=>move(fa?-1:1)} aria-label={fa?'ماه بعد':'Next month'} className="grid size-10 place-items-center rounded-xl hover:bg-[#f3f4f8]">{fa?<ChevronLeft/>:<ChevronRight/>}</button></div><div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs font-bold text-muted">{(fa?faWeek:enWeek).map(day=><span key={day} className="py-2">{day}</span>)}</div><div className="grid grid-cols-7 gap-1">{days.map((day,index)=>day===null?<span key={`empty-${index}`}/>:<DayButton key={day} day={day} disabled={startOfDay(fromJalali(view.jy,view.jm,day))<min} selected={!!selectedJ&&selectedJ.jy===view.jy&&selectedJ.jm===view.jm&&selectedJ.jd===day} today={sameDate(fromJalali(view.jy,view.jm,day),today)} onClick={()=>pick(day)} fa={fa}/>)}</div>{withTime&&<div className="mt-4 border-t hairline pt-4"><div className="mb-2 flex items-center gap-2 text-xs font-bold text-muted"><Clock size={15}/>{fa?'ساعت و دقیقه':'Hour and minute'}</div><div dir="ltr" className="flex items-center gap-2"><input aria-label={fa?'ساعت':'Hour'} inputMode="numeric" value={hour} onChange={e=>setHour(e.target.value.replace(/\D/g,'').slice(0,2))} onBlur={()=>setHour(String(clampHour(hour)).padStart(2,'0'))} className="input min-w-0 flex-1 text-center"/><strong>:</strong><input aria-label={fa?'دقیقه':'Minute'} inputMode="numeric" value={minute} onChange={e=>setMinute(e.target.value.replace(/\D/g,'').slice(0,2))} onBlur={()=>setMinute(String(clampMinute(minute)).padStart(2,'0'))} className="input min-w-0 flex-1 text-center"/><button type="button" onClick={applyTime} className="brand-gradient rounded-xl px-4 py-3 font-bold text-white">{fa?'تأیید':'Apply'}</button></div></div>}<p className="mt-3 text-center text-[11px] text-muted">{fa?'تاریخ با تقویم جلالی نمایش داده و به UTC ارسال می‌شود.':'Shown in Jalali calendar and submitted as UTC.'}</p></div>}</div>
}

function DayButton({day,disabled,selected,today,onClick,fa}:{day:number;disabled:boolean;selected:boolean;today:boolean;onClick:()=>void;fa:boolean}){return <button type="button" disabled={disabled} onClick={onClick} className={`aspect-square rounded-xl text-sm transition ${selected?'brand-gradient font-black text-white':today?'border border-purple font-black text-purple':'hover:bg-[#f0f2fa]'} disabled:cursor-not-allowed disabled:opacity-25`}>{new Intl.NumberFormat(fa?'fa-IR':'en-US',{useGrouping:false}).format(day)}</button>}
function clampHour(value:string){return Math.min(23,Math.max(0,Number(value)||0))}
function clampMinute(value:string){return Math.min(59,Math.max(0,Number(value)||0))}
function startOfDay(date:Date){return new Date(date.getFullYear(),date.getMonth(),date.getDate())}
function sameDate(a:Date,b:Date){return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate()}
function monthGrid(jy:number,jm:number){const first=fromJalali(jy,jm,1),offset=(first.getDay()+1)%7,length=jm<=6?31:jm<=11?30:isLeapJalali(jy)?30:29;return[...Array(offset).fill(null),...Array.from({length},(_,i)=>i+1)] as(Array<number|null>)}
function fromJalali(jy:number,jm:number,jd:number){const g=toGregorian(jy,jm,jd);return new Date(g.gy,g.gm-1,g.gd,12)}
function isLeapJalali(jy:number){return jalCal(jy).leap===0}

function div(a:number,b:number){return~~(a/b)}
function mod(a:number,b:number){return a-~~(a/b)*b}
function jalCal(jy:number){const breaks=[-61,9,38,199,426,686,756,818,1111,1181,1210,1635,2060,2097,2192,2262,2324,2394,2456,3178];let bl=breaks.length,gy=jy+621,leapJ=-14,jp=breaks[0]!,jm=0,jump=0;if(jy<jp||jy>=breaks[bl-1]!)throw new Error('Invalid Jalali year');for(let i=1;i<bl;i++){jm=breaks[i]!;jump=jm-jp;if(jy<jm)break;leapJ+=div(jump,33)*8+div(mod(jump,33),4);jp=jm}let n=jy-jp;leapJ+=div(n,33)*8+div(mod(n,33)+3,4);if(mod(jump,33)===4&&jump-n===4)leapJ++;const leapG=div(gy,4)-div((div(gy,100)+1)*3,4)-150;const march=20+leapJ-leapG;if(jump-n<6)n=n-jump+div(jump+4,33)*33;let leap=mod(mod(n+1,33)-1,4);if(leap===-1)leap=4;return{leap,gy,march}}
function g2d(gy:number,gm:number,gd:number){let d=div((gy+div(gm-8,6)+100100)*1461,4)+div(153*mod(gm+9,12)+2,5)+gd-34840408;d=d-div(div(gy+100100+div(gm-8,6),100)*3,4)+752;return d}
function d2g(jdn:number){let j=4*jdn+139361631;j=j+div(div(4*jdn+183187720,146097)*3,4)*4-3908;const i=div(mod(j,1461),4)*5+308;const gd=div(mod(i,153),5)+1,gm=mod(div(i,153),12)+1,gy=div(j,1461)-100100+div(8-gm,6);return{gy,gm,gd}}
function j2d(jy:number,jm:number,jd:number){const r=jalCal(jy);return g2d(r.gy,3,r.march)+(jm-1)*31-div(jm,7)*(jm-7)+jd-1}
function d2j(jdn:number):Jalali{const g=d2g(jdn),jy=g.gy-621,r=jalCal(jy),jdn1f=g2d(g.gy,3,r.march);let k=jdn-jdn1f;if(k>=0){if(k<=185)return{jy,jm:1+div(k,31),jd:mod(k,31)+1};k-=186}else{const jy2=jy-1,k2=k+179+(jalCal(jy2).leap===1?1:0);return{jy:jy2,jm:7+div(k2,30),jd:mod(k2,30)+1}}return{jy,jm:7+div(k,30),jd:mod(k,30)+1}}
function toJalali(date:Date){return d2j(g2d(date.getFullYear(),date.getMonth()+1,date.getDate()))}
function toGregorian(jy:number,jm:number,jd:number){return d2g(j2d(jy,jm,jd))}
