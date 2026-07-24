'use client';

import{useQuery}from'@tanstack/react-query';
import{api}from'@/lib/api';
import{useTranslations}from'./locale-provider';

type Locale='fa'|'en';
type Row=Record<string,unknown>;
type DisplayEntry={key:string;label:string;value:unknown};

const isRow=(value:unknown):value is Row=>typeof value==='object'&&value!==null&&!Array.isArray(value);
const text=(value:unknown)=>typeof value==='string'?value:'';

export function ResourceView({title,endpoint,empty}:{title:string;endpoint:string;empty?:string}){
  const{locale}=useTranslations(),fa=locale==='fa',query=useQuery({queryKey:[endpoint],queryFn:()=>api<unknown>(endpoint)});
  return <section><h2 className="text-3xl font-black">{title}</h2>{query.isLoading&&<div className="mt-7 grid gap-4"><div className="skeleton h-28 rounded-3xl"/><div className="skeleton h-28 rounded-3xl"/></div>}{query.isError&&<div role="alert" className="mt-7 rounded-3xl bg-red-50 p-6 text-red-800">{fa?'دریافت اطلاعات ناموفق بود.':'Could not load data.'} <button className="font-bold underline" onClick={()=>query.refetch()}>{fa?'تلاش دوباره':'Try again'}</button></div>}{query.data!=null&&<Data data={query.data} empty={empty??(fa?'داده‌ای برای نمایش وجود ندارد.':'There is no data to display.')} locale={locale}/>}</section>;
}

function Data({data,empty,locale}:{data:unknown;empty:string;locale:Locale}){
  const dataRows:unknown[]=Array.isArray(data)?data:isRow(data)&&Array.isArray(data.data)?data.data:[data];
  if(!dataRows.length)return <div className="mt-7 rounded-3xl border border-dashed hairline p-10 text-center text-muted">{empty}</div>;
  return <div className="mt-7 grid gap-4">{dataRows.map((raw,i)=>{const row=isRow(raw)?raw:{value:raw},entries=displayEntries(row,locale);return <article key={text(row.id)||i} className="overflow-hidden rounded-3xl border hairline bg-white p-6">{entries.length?<dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{entries.slice(0,15).map(entry=><div key={entry.key}><dt className="text-xs text-muted">{entry.label}</dt><dd className="mt-1 break-words font-bold">{format(entry.value,entry.key,locale)}</dd></div>)}</dl>:<p className="text-center text-sm text-muted">{empty}</p>}</article>})}</div>;
}

function displayEntries(row:Row,locale:Locale):DisplayEntry[]{
  const labels=locale==='fa'?labelsFa:labelsEn,out:DisplayEntry[]=[];
  const add=(key:string,label:string,value:unknown)=>{if(value!==undefined&&value!==null&&value!=='')out.push({key,label,value})};
  const person=(key:'user'|'student',faLabel:string,enLabel:string)=>{const item=isRow(row[key])?row[key] as Row:undefined;if(item)add(`${key}Name`,locale==='fa'?faLabel:enLabel,[text(item.name),text(item.phone)].filter(Boolean).join(' — '))};
  person('user','کاربر','User');person('student','زبان‌آموز','Student');
  const teacher=isRow(row.teacher)?row.teacher as Row:undefined;
  if(teacher)add('teacherName',locale==='fa'?'مدرس':'Teacher',(locale==='fa'?text(teacher.nameFa):text(teacher.nameEn))||text(teacher.nameFa)||text(teacher.nameEn));
  const test=isRow(row.test)?row.test as Row:undefined;
  if(test)add('testTitle',locale==='fa'?'آزمون':'Test',(locale==='fa'?text(test.titleFa):text(test.titleEn))||text(test.titleFa)||text(test.titleEn));
  const notification=isRow(row.notification)?row.notification as Row:undefined;
  if(notification)add('notificationTitle',locale==='fa'?'اعلان':'Notification',(locale==='fa'?text(notification.titleFa):text(notification.titleEn))||text(notification.titleFa)||text(notification.titleEn));
  for(const[key,value]of Object.entries(row)){
    if(hiddenKey(key)||isRow(value)||Array.isArray(value)||!['string','number','boolean'].includes(typeof value)||String(value).match(/^eyJ/))continue;
    add(key,labels[key]??humanize(key),value);
  }
  return out;
}

function hiddenKey(key:string){return key==='id'||/Id(s)?$/.test(key)||['tokenHash','checksum','authority','idempotencyKey','gatewayReference','callbackPayload','policySnapshot'].includes(key)}
function humanize(key:string){return key.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^./,char=>char.toUpperCase())}

const labelsFa:Record<string,string>={name:'نام',nameFa:'نام فارسی',nameEn:'نام انگلیسی',phone:'موبایل',email:'ایمیل',status:'وضعیت',role:'نقش',startsAt:'شروع',endsAt:'پایان',amount:'مبلغ',price:'قیمت',overallBand:'نمره کل',title:'عنوان',titleFa:'عنوان فارسی',titleEn:'عنوان انگلیسی',subject:'موضوع',category:'دسته',priority:'اولویت',createdAt:'ایجاد',updatedAt:'آخرین تغییر',targetBand:'نمره هدف',balance:'موجودی',published:'انتشار',durationMinutes:'مدت',purpose:'بابت',type:'نوع',action:'عملیات',entity:'بخش',locale:'زبان',timezone:'منطقه زمانی',activeTeachers:'مدرسان فعال',pendingTeachers:'مدرسان در انتظار',testAttempts:'تلاش‌های آزمون',pendingReviews:'آزمون‌های در انتظار بررسی',bookings:'رزروها',payments:'پرداخت‌ها',payouts:'تسویه‌ها',openTickets:'تیکت‌های باز',revenue:'درآمد',walletLiability:'تعهد کیف پول'};
const labelsEn:Record<string,string>={name:'Name',nameFa:'Persian name',nameEn:'English name',phone:'Phone',email:'Email',status:'Status',role:'Role',startsAt:'Starts',endsAt:'Ends',amount:'Amount',price:'Price',overallBand:'Overall band',title:'Title',titleFa:'Persian title',titleEn:'English title',subject:'Subject',category:'Category',priority:'Priority',createdAt:'Created',updatedAt:'Last updated',targetBand:'Target band',balance:'Balance',published:'Published',durationMinutes:'Duration',purpose:'Purpose',type:'Type',action:'Action',entity:'Area',locale:'Language',timezone:'Timezone',activeTeachers:'Active teachers',pendingTeachers:'Pending teachers',testAttempts:'Test attempts',pendingReviews:'Reviews pending',bookings:'Bookings',payments:'Payments',payouts:'Payouts',openTickets:'Open tickets',revenue:'Revenue',walletLiability:'Wallet liability'};

const faStatus:Record<string,string>={ACTIVE:'فعال',SUSPENDED:'تعلیق‌شده',DELETED:'حذف‌شده',PENDING:'در انتظار',PENDING_PAYMENT:'در انتظار پرداخت',PAID:'پرداخت‌شده',PARTIALLY_REFUNDED:'بخشی بازپرداخت‌شده',REFUNDED:'بازپرداخت‌شده',CONFIRMED:'تأییدشده',COMPLETED:'تکمیل‌شده',CANCELLED:'لغوشده',NO_SHOW:'عدم حضور',OPEN:'باز',WAITING_SUPPORT:'منتظر پشتیبانی',RESOLVED:'حل‌شده',CLOSED:'بسته',DRAFT:'پیش‌نویس',SUBMITTED:'ارسال‌شده',DOCUMENT_REVIEW:'بررسی مدارک',INTERVIEW:'مصاحبه',DEMO_REVIEW:'بررسی دمو',APPROVED:'تأییدشده',REJECTED:'ردشده',IN_PROGRESS:'در حال انجام',NEEDS_REVISION:'نیازمند اصلاح',UNDER_REVIEW:'در حال بررسی'};
function format(value:unknown,key:string,locale:Locale){
  if(typeof value==='string'&&(/At$/.test(key)||['startsAt','endsAt','examDate','dueAt'].includes(key))){const date=new Date(value);if(!isNaN(date.getTime()))return new Intl.DateTimeFormat(locale==='fa'?'fa-IR':'en-US',{dateStyle:'medium',timeStyle:key==='examDate'||key==='dueAt'?undefined:'short'}).format(date)}
  if(typeof value==='number'&&['amount','price','balance','revenue','walletLiability'].some(part=>key.toLowerCase().includes(part.toLowerCase())))return new Intl.NumberFormat(locale==='fa'?'fa-IR':'en-US').format(value)+(locale==='fa'?' تومان':' IRR');
  if(typeof value==='boolean')return locale==='fa'?(value?'بله':'خیر'):(value?'Yes':'No');
  if(typeof value==='string'){const translated=locale==='fa'?faStatus[value]:enStatus[value];if(translated)return translated}
  return String(value);
}

const enStatus:Record<string,string>={ACTIVE:'Active',SUSPENDED:'Suspended',DELETED:'Deleted',PENDING:'Pending',PENDING_PAYMENT:'Pending payment',PAID:'Paid',PARTIALLY_REFUNDED:'Partially refunded',REFUNDED:'Refunded',CONFIRMED:'Confirmed',COMPLETED:'Completed',CANCELLED:'Cancelled',NO_SHOW:'No-show',OPEN:'Open',WAITING_SUPPORT:'Waiting for support',RESOLVED:'Resolved',CLOSED:'Closed',DRAFT:'Draft',SUBMITTED:'Submitted',UNDER_REVIEW:'Under review',DOCUMENT_REVIEW:'Document review',INTERVIEW:'Interview',DEMO_REVIEW:'Demo review',APPROVED:'Approved',REJECTED:'Rejected',NEEDS_REVISION:'Needs revision',IN_PROGRESS:'In progress'};
