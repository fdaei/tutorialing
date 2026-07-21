'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import { useTranslations } from './locale-provider';

type Role = 'student' | 'teacher' | 'admin';
type Props = { role: Role; section: string; endpoint: string };
type Localized = { fa: boolean };
type UploadResponse = { fileId: string; uploadUrl: string };

const tr = (fa: boolean, persian: string, english: string) => fa ? persian : english;
const value = (form: FormData, key: string) => String(form.get(key) ?? '').trim();
const numeric = (form: FormData, key: string, fallback = 0) => {
  const out = Number(form.get(key));
  return Number.isFinite(out) ? out : fallback;
};
const list = (form: FormData, key: string) => value(form, key).split(',').map((x) => x.trim()).filter(Boolean);

async function sha256(file: File) {
  const data = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(data)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function uploadFile(file: File, purpose: string) {
  const checksum = await sha256(file);
  const upload = await api<UploadResponse>('/files/uploads', {
    method: 'POST',
    body: JSON.stringify({ originalName: file.name, mimeType: file.type, size: file.size, checksum, purpose }),
  });
  await fetch(upload.uploadUrl, { method: 'PUT', body: file, headers: { 'content-type': file.type, 'x-amz-meta-checksum': checksum } });
  await api(`/files/${upload.fileId}/complete`, { method: 'POST' });
  return upload.fileId;
}

function useAction(endpoint: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (task: () => Promise<unknown>) => task(),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [endpoint] }),
        queryClient.invalidateQueries({ queryKey: ['panel-me'] }),
      ]);
    },
  });
}

function Status({ error, ok, fa }: { error: unknown; ok: boolean } & Localized) {
  if (error) return <p role="alert" className="mt-3 rounded-2xl bg-red-50 p-3 text-sm text-red-800">{error instanceof ApiError ? error.message : tr(fa, 'عملیات ناموفق بود.', 'The operation failed.')}</p>;
  if (ok) return <p role="status" className="mt-3 rounded-2xl bg-lavender p-3 text-sm font-bold text-purple">{tr(fa, 'با موفقیت ذخیره شد.', 'Saved successfully.')}</p>;
  return null;
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mb-7 rounded-3xl border hairline bg-white p-5 shadow-soft"><h3 className="text-lg font-black">{title}</h3>{children}</section>;
}

function Field({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <label className="block"><span className="mb-2 block text-sm font-bold">{label}</span><input {...props} className="w-full rounded-2xl border hairline px-4 py-3 outline-none transition focus:border-purple focus:ring-4 focus:ring-violet/15" /></label>;
}

function Area({ label, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return <label className="block"><span className="mb-2 block text-sm font-bold">{label}</span><textarea {...props} className="min-h-28 w-full rounded-2xl border hairline px-4 py-3 outline-none transition focus:border-purple focus:ring-4 focus:ring-violet/15" /></label>;
}

function Select({ label, name, children }: { label: string; name: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-sm font-bold">{label}</span><select name={name} className="w-full rounded-2xl border hairline bg-white px-4 py-3">{children}</select></label>;
}

type RecordValue=Record<string,unknown>;
type Option={value:string;label:string};
const isRecord=(input:unknown):input is RecordValue=>typeof input==='object'&&input!==null&&!Array.isArray(input);
const rows=(input:unknown):RecordValue[]=>Array.isArray(input)?input.filter(isRecord):isRecord(input)&&Array.isArray(input.data)?input.data.filter(isRecord):[];
const stringValue=(input:unknown)=>typeof input==='string'?input:'';
const nested=(input:unknown,key:string)=>isRecord(input)&&isRecord(input[key])?input[key] as RecordValue:undefined;
const localizedDate=(input:unknown,fa:boolean)=>{if(typeof input!=='string')return'';const date=new Date(input);return Number.isFinite(date.getTime())?new Intl.DateTimeFormat(fa?'fa-IR':'en-US',{dateStyle:'medium',timeStyle:'short'}).format(date):''};

function EntitySelect({name,label,endpoint,options,fa}:{name:string;label:string;endpoint:string;options:(data:unknown)=>Option[];fa:boolean}){
  const query=useQuery({queryKey:['entity-options',endpoint],queryFn:()=>api<unknown>(endpoint)}),items=query.data?options(query.data):[];
  return <label className="block"><span className="mb-2 block text-sm font-bold">{label}</span><select name={name} required disabled={query.isLoading||query.isError||!items.length} defaultValue="" className="w-full rounded-2xl border hairline bg-white px-4 py-3 disabled:bg-[#f4f5f8] disabled:text-muted"><option value="" disabled>{query.isLoading?tr(fa,'در حال دریافت گزینه‌ها…','Loading options…'):query.isError?tr(fa,'دریافت گزینه‌ها ناموفق بود','Could not load options'):!items.length?tr(fa,'گزینه‌ای در دسترس نیست','No options available'):tr(fa,'انتخاب کنید','Choose an option')}</option>{items.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</select>{query.isError&&<button type="button" onClick={()=>query.refetch()} className="mt-2 text-xs font-bold text-purple underline">{tr(fa,'تلاش دوباره','Try again')}</button>}</label>;
}

function AssignmentSelect({fa}:{fa:boolean}){return <EntitySelect name="assignmentId" label={tr(fa,'تکلیف','Assignment')} endpoint="/learning/plans" fa={fa} options={data=>rows(data).flatMap(plan=>Array.isArray(plan.assignments)?plan.assignments.filter(isRecord).filter(assignment=>assignment.status!=='submitted').map(assignment=>({value:stringValue(assignment.id),label:`${stringValue(assignment.title)||tr(fa,'تکلیف بدون عنوان','Untitled assignment')} — ${stringValue(plan.title)||tr(fa,'برنامه یادگیری','Learning plan')}${assignment.dueAt?` · ${localizedDate(assignment.dueAt,fa)}`:''}`})).filter(option=>option.value):[])}/>}
function LearningPlanSelect({fa}:{fa:boolean}){return <EntitySelect name="planId" label={tr(fa,'برنامه یادگیری','Learning plan')} endpoint="/learning/plans" fa={fa} options={data=>rows(data).map(plan=>{const student=nested(plan,'student');return{value:stringValue(plan.id),label:[stringValue(plan.title)||tr(fa,'برنامه بدون عنوان','Untitled plan'),stringValue(student?.name)||tr(fa,'زبان‌آموز','Student')].join(' — ')}}).filter(option=>option.value)}/>}
function StudentSelect({fa}:{fa:boolean}){return <EntitySelect name="studentId" label={tr(fa,'زبان‌آموز','Student')} endpoint="/bookings/students" fa={fa} options={data=>rows(data).filter(student=>!Array.isArray(student.bookings)||student.bookings.some(booking=>isRecord(booking)&&booking.status==='COMPLETED')).map(student=>({value:stringValue(student.id),label:[stringValue(student.name)||tr(fa,'بدون نام','Unnamed'),stringValue(student.phone)].filter(Boolean).join(' — ')})).filter(option=>option.value)}/>}
function BookingSelect({fa}:{fa:boolean}){return <EntitySelect name="bookingId" label={tr(fa,'کلاس رزروشده','Booked class')} endpoint="/bookings/me" fa={fa} options={data=>rows(data).filter(booking=>booking.status==='CONFIRMED').map(booking=>{const student=nested(booking,'student');return{value:stringValue(booking.id),label:`${stringValue(student?.name)||stringValue(student?.phone)||tr(fa,'زبان‌آموز','Student')} — ${localizedDate(booking.startsAt,fa)}`}}).filter(option=>option.value)}/>}
function AdminUserSelect({fa}:{fa:boolean}){return <EntitySelect name="userId" label={tr(fa,'کاربر','User')} endpoint="/admin/users?page=1" fa={fa} options={data=>rows(data).map(user=>({value:stringValue(user.id),label:[stringValue(user.name)||tr(fa,'بدون نام','Unnamed'),stringValue(user.phone),stringValue(user.email)].filter(Boolean).join(' — ')})).filter(option=>option.value)}/>}
function TeacherApplicationSelect({fa}:{fa:boolean}){return <EntitySelect name="teacherId" label={tr(fa,'درخواست مدرس','Teacher application')} endpoint="/admin/teacher-applications" fa={fa} options={data=>rows(data).map(teacher=>{const user=nested(teacher,'user');return{value:stringValue(teacher.id),label:[fa?stringValue(teacher.nameFa):stringValue(teacher.nameEn),stringValue(user?.phone),stringValue(teacher.status)].filter(Boolean).join(' — ')}}).filter(option=>option.value)}/>}
function ApprovedTeacherSelect({fa}:{fa:boolean}){return <EntitySelect name="teacherId" label={tr(fa,'مدرس','Teacher')} endpoint="/teachers?limit=50" fa={fa} options={data=>rows(data).map(teacher=>({value:stringValue(teacher.id),label:[fa?stringValue(teacher.nameFa):stringValue(teacher.nameEn),stringValue(teacher.specialties)].filter(Boolean).join(' — ')})).filter(option=>option.value)}/>}
function PaymentSelect({fa}:{fa:boolean}){return <EntitySelect name="paymentId" label={tr(fa,'پرداخت','Payment')} endpoint="/admin/payments" fa={fa} options={data=>rows(data).filter(payment=>['PAID','PARTIALLY_REFUNDED'].includes(stringValue(payment.status))).map(payment=>{const user=nested(payment,'user'),amount=typeof payment.amount==='number'?new Intl.NumberFormat(fa?'fa-IR':'en-US').format(payment.amount):'';return{value:stringValue(payment.id),label:[stringValue(user?.name)||stringValue(user?.phone)||tr(fa,'کاربر','User'),amount&&(fa?`${amount} تومان`:`${amount} IRR`),localizedDate(payment.createdAt,fa),stringValue(payment.status)].filter(Boolean).join(' — ')}}).filter(option=>option.value)}/>}

function Submit({ busy, fa, children }: { busy: boolean; children: React.ReactNode } & Localized) {
  return <button disabled={busy} className="mt-4 rounded-full bg-gradient-to-r from-blue to-purple px-6 py-3 font-black text-white shadow-lg shadow-purple/15 transition hover:-translate-y-0.5 disabled:opacity-50">{busy ? tr(fa, 'در حال انجام…', 'Working…') : children}</button>;
}

export function PanelActions({ role, section, endpoint }: Props) {
  const { locale } = useTranslations();
  const fa = locale === 'fa';
  if (role === 'student') return <StudentActions section={section} endpoint={endpoint} fa={fa} />;
  if (role === 'teacher') return <TeacherActions section={section} endpoint={endpoint} fa={fa} />;
  return <AdminActions section={section} endpoint={endpoint} fa={fa} />;
}

function StudentActions({ section, endpoint, fa }: Omit<Props, 'role'> & Localized) {
  const action = useAction(endpoint);
  if (section === 'profile') return <Shell title={tr(fa, 'تکمیل پروفایل', 'Complete profile')}>
    <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={(event) => {
      event.preventDefault(); const form = new FormData(event.currentTarget);
      action.mutate(() => api('/users/me', { method: 'PUT', body: JSON.stringify({ name: value(form, 'name'), email: value(form, 'email') || undefined, locale: value(form, 'locale') || (fa ? 'fa' : 'en'), timezone: value(form, 'timezone') || 'Asia/Tehran' }) }));
    }}>
      <Field name="name" label={tr(fa, 'نام', 'Name')} required />
      <Field name="email" label={tr(fa, 'ایمیل', 'Email')} type="email" dir="ltr" />
      <Select name="locale" label={tr(fa, 'زبان رابط', 'Interface language')}><option value="fa">فارسی</option><option value="en">English</option></Select>
      <Field name="timezone" label={tr(fa, 'منطقه زمانی', 'Timezone')} defaultValue="Asia/Tehran" dir="ltr" />
      <div className="md:col-span-2"><Submit fa={fa} busy={action.isPending}>{tr(fa, 'ذخیره پروفایل', 'Save profile')}</Submit></div>
    </form><Status fa={fa} error={action.error} ok={action.isSuccess} />
  </Shell>;
  if (section === 'tickets') return <TicketForm endpoint={endpoint} fa={fa} />;
  if (section === 'plan') return <Shell title={tr(fa, 'ارسال پاسخ تکلیف', 'Submit assignment')}>
    <form className="mt-4 grid gap-4" onSubmit={(event) => {
      event.preventDefault(); const form = new FormData(event.currentTarget);
      action.mutate(() => api(`/learning/assignments/${value(form, 'assignmentId')}/submit`, { method: 'POST', body: JSON.stringify({ submission: value(form, 'submission') }) }));
    }}>
      <AssignmentSelect fa={fa} />
      <Area name="submission" label={tr(fa, 'پاسخ', 'Response')} required />
      <Submit fa={fa} busy={action.isPending}>{tr(fa, 'ارسال پاسخ', 'Submit response')}</Submit>
    </form><Status fa={fa} error={action.error} ok={action.isSuccess} />
  </Shell>;
  return null;
}

function TeacherActions({ section, endpoint, fa }: Omit<Props, 'role'> & Localized) {
  const action = useAction(endpoint);
  if (section === 'verification') return <div className="grid gap-5 xl:grid-cols-2">
    <Shell title={tr(fa, 'پروفایل درخواست مدرس', 'Teacher application profile')}>
      <form className="mt-4 grid gap-4" onSubmit={(event) => {
        event.preventDefault(); const form = new FormData(event.currentTarget);
        action.mutate(() => api('/teacher/application', { method: 'POST', body: JSON.stringify({ nameFa: value(form, 'nameFa'), nameEn: value(form, 'nameEn'), bioFa: value(form, 'bioFa'), bioEn: value(form, 'bioEn'), specialties: list(form, 'specialties'), languages: list(form, 'languages'), experienceYears: numeric(form, 'experienceYears') }) }));
      }}>
        <Field name="nameFa" label={tr(fa, 'نام فارسی', 'Persian name')} required />
        <Field name="nameEn" label={tr(fa, 'نام انگلیسی', 'English name')} required dir="ltr" />
        <Area name="bioFa" label={tr(fa, 'بیوگرافی فارسی', 'Persian biography')} required />
        <Area name="bioEn" label={tr(fa, 'بیوگرافی انگلیسی', 'English biography')} required dir="ltr" />
        <Field name="specialties" label={tr(fa, 'تخصص‌ها، جداشده با کاما', 'Specialties, comma separated')} defaultValue="writing,speaking" dir="ltr" />
        <Field name="languages" label={tr(fa, 'زبان‌ها، جداشده با کاما', 'Languages, comma separated')} defaultValue="fa,en" dir="ltr" />
        <Field name="experienceYears" label={tr(fa, 'سال تجربه', 'Years of experience')} type="number" min={0} defaultValue={3} />
        <Submit fa={fa} busy={action.isPending}>{tr(fa, 'ذخیره درخواست', 'Save application')}</Submit>
      </form><Status fa={fa} error={action.error} ok={action.isSuccess} />
    </Shell>
    <TeacherFiles endpoint={endpoint} fa={fa} />
  </div>;

  if (section === 'availability') return <div className="grid gap-5 xl:grid-cols-3">
    <Shell title={tr(fa, 'قانون هفتگی', 'Weekly rule')}>
      <form className="mt-4 grid gap-4" onSubmit={(event) => {
        event.preventDefault(); const form = new FormData(event.currentTarget);
        action.mutate(() => api('/availability/me/rules', { method: 'PUT', body: JSON.stringify({ rules: [{ weekday: numeric(form, 'weekday'), startMinute: numeric(form, 'startMinute', 540), endMinute: numeric(form, 'endMinute', 1020), timezone: value(form, 'timezone') || 'Asia/Tehran' }] }) }));
      }}>
        <Field name="weekday" label={tr(fa, 'روز هفته (۰ تا ۶)', 'Weekday (0–6)')} type="number" min={0} max={6} defaultValue={6} />
        <Field name="startMinute" label={tr(fa, 'دقیقه شروع روز', 'Start minute of day')} type="number" min={0} max={1440} defaultValue={540} />
        <Field name="endMinute" label={tr(fa, 'دقیقه پایان روز', 'End minute of day')} type="number" min={0} max={1440} defaultValue={1020} />
        <Field name="timezone" label={tr(fa, 'منطقه زمانی', 'Timezone')} defaultValue="Asia/Tehran" dir="ltr" />
        <Submit fa={fa} busy={action.isPending}>{tr(fa, 'ثبت قانون', 'Save rule')}</Submit>
      </form><Status fa={fa} error={action.error} ok={action.isSuccess} />
    </Shell>
    <Shell title={tr(fa, 'استثنای روز خاص', 'Date override')}>
      <form className="mt-4 grid gap-4" onSubmit={(event) => {
        event.preventDefault(); const form = new FormData(event.currentTarget);
        action.mutate(() => api('/availability/me/overrides', { method: 'POST', body: JSON.stringify({ date: value(form, 'date'), available: form.get('available') === 'on', startMinute: numeric(form, 'startMinute'), endMinute: numeric(form, 'endMinute'), reason: value(form, 'reason') || undefined }) }));
      }}>
        <Field name="date" label={tr(fa, 'تاریخ', 'Date')} type="date" required />
        <label className="flex gap-2 text-sm font-bold"><input name="available" type="checkbox" defaultChecked />{tr(fa, 'در دسترس', 'Available')}</label>
        <Field name="startMinute" label={tr(fa, 'دقیقه شروع', 'Start minute')} type="number" min={0} max={1440} defaultValue={540} />
        <Field name="endMinute" label={tr(fa, 'دقیقه پایان', 'End minute')} type="number" min={0} max={1440} defaultValue={1020} />
        <Field name="reason" label={tr(fa, 'دلیل', 'Reason')} />
        <Submit fa={fa} busy={action.isPending}>{tr(fa, 'ثبت استثنا', 'Save override')}</Submit>
      </form>
    </Shell>
    <Shell title={tr(fa, 'مسدودسازی بازه', 'Block time range')}>
      <form className="mt-4 grid gap-4" onSubmit={(event) => {
        event.preventDefault(); const form = new FormData(event.currentTarget);
        action.mutate(() => api('/availability/me/blocks', { method: 'POST', body: JSON.stringify({ startsAt: new Date(value(form, 'startsAt')).toISOString(), endsAt: new Date(value(form, 'endsAt')).toISOString(), reason: value(form, 'reason') || undefined }) }));
      }}>
        <Field name="startsAt" label={tr(fa, 'شروع', 'Starts at')} type="datetime-local" required />
        <Field name="endsAt" label={tr(fa, 'پایان', 'Ends at')} type="datetime-local" required />
        <Field name="reason" label={tr(fa, 'دلیل', 'Reason')} />
        <Submit fa={fa} busy={action.isPending}>{tr(fa, 'مسدود کن', 'Block period')}</Submit>
      </form><Status fa={fa} error={action.error} ok={action.isSuccess} />
    </Shell>
  </div>;
  if (section === 'packages') return <PackageForm endpoint={endpoint} fa={fa} />;
  if (section === 'plans') return <PlanForm endpoint={endpoint} fa={fa} />;
  if (section === 'classes') return <ClassActions endpoint={endpoint} fa={fa} />;
  if (section === 'tickets') return <TicketForm endpoint={endpoint} fa={fa} />;
  return null;
}

function TeacherFiles({ endpoint, fa }: { endpoint: string } & Localized) {
  const action = useAction(endpoint);
  const [busy, setBusy] = useState(false);
  const [fileError, setFileError] = useState('');
  return <Shell title={tr(fa, 'مدارک و ویدئوی معرفی', 'Documents and introduction video')}>
    <form className="mt-4 grid gap-4" onSubmit={async (event) => {
      event.preventDefault(); setBusy(true); setFileError(''); const form = new FormData(event.currentTarget);
      try {
        const file = form.get('file');
        if (!(file instanceof File) || !file.size) throw new Error(tr(fa, 'فایلی انتخاب نشده است.', 'Select a file first.'));
        const kind = value(form, 'kind');
        const fileId = await uploadFile(file, kind === 'intro-video' ? 'teacher-intro-video' : 'teacher-verification');
        action.mutate(() => kind === 'intro-video' ? api('/teacher/profile/intro-video', { method: 'PUT', body: JSON.stringify({ fileId }) }) : api('/teacher/application/documents', { method: 'POST', body: JSON.stringify({ kind, fileId }) }));
      } catch (error) { setFileError(error instanceof Error ? error.message : tr(fa, 'آپلود ناموفق بود.', 'Upload failed.')); }
      finally { setBusy(false); }
    }}>
      <Select name="kind" label={tr(fa, 'نوع مدرک', 'Document type')}><option value="identity">{tr(fa, 'هویت', 'Identity')}</option><option value="certificate">{tr(fa, 'مدرک آموزشی', 'Certificate')}</option><option value="demo">{tr(fa, 'دموی تدریس', 'Teaching demo')}</option><option value="intro-video">{tr(fa, 'ویدئوی معرفی', 'Introduction video')}</option></Select>
      <input name="file" type="file" className="rounded-2xl border hairline p-3" required />
      <Submit fa={fa} busy={busy || action.isPending}>{tr(fa, 'آپلود و اتصال', 'Upload and attach')}</Submit>
    </form>
    <form className="mt-5" onSubmit={(event) => { event.preventDefault(); action.mutate(() => api('/teacher/application/submit', { method: 'POST' })); }}><Submit fa={fa} busy={action.isPending}>{tr(fa, 'ارسال برای بررسی', 'Submit for review')}</Submit></form>
    {fileError && <p role="alert" className="mt-3 rounded-2xl bg-red-50 p-3 text-sm text-red-800">{fileError}</p>}
    <Status fa={fa} error={action.error} ok={action.isSuccess} />
  </Shell>;
}

function TicketForm({ endpoint, fa }: { endpoint: string } & Localized) {
  const action = useAction(endpoint);
  return <Shell title={tr(fa, 'تیکت پشتیبانی', 'Support ticket')}>
    <form className="mt-4 grid gap-4" onSubmit={(event) => {
      event.preventDefault(); const form = new FormData(event.currentTarget);
      action.mutate(() => api('/support/tickets', { method: 'POST', body: JSON.stringify({ subject: value(form, 'subject'), category: value(form, 'category') || 'general', priority: value(form, 'priority') || 'normal', body: value(form, 'body') }) }));
    }}>
      <Field name="subject" label={tr(fa, 'موضوع', 'Subject')} required />
      <Field name="category" label={tr(fa, 'دسته', 'Category')} defaultValue="general" dir="ltr" />
      <Select name="priority" label={tr(fa, 'اولویت', 'Priority')}><option value="normal">{tr(fa, 'معمولی', 'Normal')}</option><option value="high">{tr(fa, 'بالا', 'High')}</option><option value="urgent">{tr(fa, 'فوری', 'Urgent')}</option></Select>
      <Area name="body" label={tr(fa, 'شرح', 'Message')} required />
      <Submit fa={fa} busy={action.isPending}>{tr(fa, 'ثبت تیکت', 'Create ticket')}</Submit>
    </form><Status fa={fa} error={action.error} ok={action.isSuccess} />
  </Shell>;
}

function PackageForm({ endpoint, fa }: { endpoint: string } & Localized) {
  const action = useAction(endpoint);
  return <Shell title={tr(fa, 'ایجاد بسته آموزشی', 'Create teaching package')}>
    <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={(event) => {
      event.preventDefault(); const form = new FormData(event.currentTarget);
      action.mutate(() => api('/packages', { method: 'POST', body: JSON.stringify({ titleFa: value(form, 'titleFa'), titleEn: value(form, 'titleEn'), descriptionFa: value(form, 'descriptionFa'), descriptionEn: value(form, 'descriptionEn'), credits: numeric(form, 'credits', 8), lessonMinutes: numeric(form, 'lessonMinutes', 60), price: numeric(form, 'price') }) }));
    }}>
      <Field name="titleFa" label={tr(fa, 'عنوان فارسی', 'Persian title')} required />
      <Field name="titleEn" label={tr(fa, 'عنوان انگلیسی', 'English title')} required dir="ltr" />
      <Field name="credits" label={tr(fa, 'تعداد اعتبار', 'Lesson credits')} type="number" min={1} defaultValue={8} />
      <Field name="lessonMinutes" label={tr(fa, 'دقیقه هر جلسه', 'Minutes per lesson')} type="number" min={15} defaultValue={60} />
      <Field name="price" label={tr(fa, 'قیمت به تومان', 'Price in toman')} type="number" min={1} required />
      <Area name="descriptionFa" label={tr(fa, 'توضیح فارسی', 'Persian description')} required />
      <Area name="descriptionEn" label={tr(fa, 'توضیح انگلیسی', 'English description')} required dir="ltr" />
      <div className="md:col-span-2"><Submit fa={fa} busy={action.isPending}>{tr(fa, 'ثبت بسته برای تأیید', 'Submit package for approval')}</Submit></div>
    </form><Status fa={fa} error={action.error} ok={action.isSuccess} />
  </Shell>;
}

function PlanForm({ endpoint, fa }: { endpoint: string } & Localized) {
  const action = useAction(endpoint);
  return <div className="grid gap-5 xl:grid-cols-2"><Shell title={tr(fa, 'ساخت برنامه یادگیری', 'Create learning plan')}>
    <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={(event) => {
      event.preventDefault(); const form = new FormData(event.currentTarget);
      action.mutate(() => api('/learning/plans', { method: 'POST', body: JSON.stringify({ studentId: value(form, 'studentId'), title: value(form, 'title'), targetBand: numeric(form, 'targetBand', 7), examDate: value(form, 'examDate') || undefined, weakSkills: list(form, 'weakSkills'), milestones: [{ title: value(form, 'milestone'), order: 1, dueAt: value(form, 'dueAt') || undefined }] }) }));
    }}>
      <StudentSelect fa={fa} />
      <Field name="title" label={tr(fa, 'عنوان برنامه', 'Plan title')} required />
      <Field name="targetBand" label={tr(fa, 'نمره هدف', 'Target band')} type="number" step="0.5" min={4} max={9} defaultValue={7} />
      <Field name="examDate" label={tr(fa, 'تاریخ آزمون', 'Exam date')} type="date" />
      <Field name="weakSkills" label={tr(fa, 'مهارت‌های ضعیف با کاما', 'Weak skills, comma separated')} defaultValue="writing,speaking" dir="ltr" />
      <Field name="milestone" label={tr(fa, 'اولین نقطه عطف', 'First milestone')} required />
      <Field name="dueAt" label={tr(fa, 'مهلت', 'Due date')} type="date" />
      <div className="md:col-span-2"><Submit fa={fa} busy={action.isPending}>{tr(fa, 'ساخت برنامه', 'Create plan')}</Submit></div>
    </form><Status fa={fa} error={action.error} ok={action.isSuccess} />
  </Shell><Shell title={tr(fa,'افزودن تکلیف به برنامه','Add an assignment to a plan')}><form className="mt-4 grid gap-4" onSubmit={(event)=>{event.preventDefault();const form=new FormData(event.currentTarget);action.mutate(()=>api(`/learning/plans/${value(form,'planId')}/assignments`,{method:'POST',body:JSON.stringify({title:value(form,'assignmentTitle'),instructions:value(form,'instructions'),dueAt:value(form,'assignmentDueAt')||undefined})}))}}><LearningPlanSelect fa={fa}/><Field name="assignmentTitle" label={tr(fa,'عنوان تکلیف','Assignment title')} required/><Area name="instructions" label={tr(fa,'توضیحات و روش تحویل','Instructions and submission details')} required/><Field name="assignmentDueAt" label={tr(fa,'مهلت تحویل','Due date')} type="date"/><Submit fa={fa} busy={action.isPending}>{tr(fa,'ثبت تکلیف','Add assignment')}</Submit></form><Status fa={fa} error={action.error} ok={action.isSuccess}/></Shell></div>;
}

function ClassActions({ endpoint, fa }: { endpoint: string } & Localized) {
  const action = useAction(endpoint);
  return <Shell title={tr(fa, 'حضور، لینک جلسه و تکمیل کلاس', 'Attendance, meeting link and class completion')}>
    <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={(event) => {
      event.preventDefault(); const form = new FormData(event.currentTarget);
      action.mutate(() => api(`/bookings/${value(form, 'bookingId')}/attendance`, { method: 'PUT', body: JSON.stringify({ student: form.get('student') === 'on', teacher: form.get('teacher') === 'on', meetingUrl: value(form, 'meetingUrl') || undefined }) }));
    }}>
      <BookingSelect fa={fa} />
      <Field name="meetingUrl" label={tr(fa, 'لینک جلسه', 'Meeting URL')} type="url" dir="ltr" />
      <label className="flex gap-2"><input name="student" type="checkbox" />{tr(fa, 'حضور زبان‌آموز', 'Student attended')}</label>
      <label className="flex gap-2"><input name="teacher" type="checkbox" defaultChecked />{tr(fa, 'حضور مدرس', 'Teacher attended')}</label>
      <div className="md:col-span-2"><Submit fa={fa} busy={action.isPending}>{tr(fa, 'ثبت حضور', 'Save attendance')}</Submit></div>
    </form>
    <form className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); action.mutate(() => api(`/bookings/${value(form, 'bookingId')}/complete`, { method: 'POST' })); }}>
      <BookingSelect fa={fa} />
      <div><Submit fa={fa} busy={action.isPending}>{tr(fa, 'تکمیل کلاس', 'Complete class')}</Submit></div>
    </form><Status fa={fa} error={action.error} ok={action.isSuccess} />
  </Shell>;
}

function AdminActions({ section, endpoint, fa }: Omit<Props, 'role'> & Localized) {
  if (section === 'users') return <AdminUserActions endpoint={endpoint} fa={fa} />;
  if (section === 'teachers') return <AdminTeacherActions endpoint={endpoint} fa={fa} />;
  if (section === 'settings') return <AdminSettingsActions endpoint={endpoint} fa={fa} />;
  if (section === 'bookings') return <AdminBookingActions endpoint={endpoint} fa={fa} />;
  if (section === 'payments') return <AdminFinanceActions endpoint={endpoint} fa={fa} />;
  if (section === 'roles') return <AdminRoleActions endpoint={endpoint} fa={fa} />;
  if (section === 'tickets') return <TicketForm endpoint={endpoint} fa={fa} />;
  return null;
}

function AdminUserActions({ endpoint, fa }: { endpoint: string } & Localized) {
  const action = useAction(endpoint);
  return <div className="grid gap-5 xl:grid-cols-2">
    <Shell title={tr(fa, 'ساخت کاربر', 'Create user')}><form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={(event) => {
      event.preventDefault(); const form = new FormData(event.currentTarget);
      action.mutate(() => api('/admin/users', { method: 'POST', body: JSON.stringify({ phone: value(form, 'phone'), name: value(form, 'name'), email: value(form, 'email') || undefined, locale: value(form, 'locale'), roles: [value(form, 'role')] }) }));
    }}>
      <Field name="phone" label={tr(fa, 'شماره موبایل', 'Phone number')} pattern="09[0-9]{9}" required dir="ltr" />
      <Field name="name" label={tr(fa, 'نام', 'Name')} required />
      <Field name="email" label={tr(fa, 'ایمیل', 'Email')} type="email" dir="ltr" />
      <Select name="locale" label={tr(fa, 'زبان', 'Language')}><option value="fa">فارسی</option><option value="en">English</option></Select>
      <Select name="role" label={tr(fa, 'نقش اولیه', 'Initial role')}><RoleOptions /></Select>
      <div className="md:col-span-2"><Submit fa={fa} busy={action.isPending}>{tr(fa, 'ساخت کاربر', 'Create user')}</Submit></div>
    </form><Status fa={fa} error={action.error} ok={action.isSuccess} /></Shell>
    <Shell title={tr(fa, 'تغییر وضعیت کاربر', 'Change user status')}><form className="mt-4 grid gap-4" onSubmit={(event) => {
      event.preventDefault(); const form = new FormData(event.currentTarget);
      action.mutate(() => api(`/admin/users/${value(form, 'userId')}/status`, { method: 'PATCH', body: JSON.stringify({ status: value(form, 'status') }) }));
    }}>
      <AdminUserSelect fa={fa} />
      <Select name="status" label={tr(fa, 'وضعیت', 'Status')}><option>ACTIVE</option><option>SUSPENDED</option><option>DELETED</option></Select>
      <Submit fa={fa} busy={action.isPending}>{tr(fa, 'اعمال وضعیت', 'Update status')}</Submit>
    </form></Shell>
  </div>;
}

function AdminTeacherActions({ endpoint, fa }: { endpoint: string } & Localized) {
  const action = useAction(endpoint);
  return <Shell title={tr(fa, 'تغییر وضعیت درخواست مدرس', 'Review teacher application')}><form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={(event) => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    action.mutate(() => api(`/admin/teacher-applications/${value(form, 'teacherId')}/transition`, { method: 'POST', body: JSON.stringify({ status: value(form, 'status'), note: value(form, 'note') || undefined }) }));
  }}>
    <TeacherApplicationSelect fa={fa} />
    <Select name="status" label={tr(fa, 'وضعیت بعدی', 'Next status')}><option>DOCUMENT_REVIEW</option><option>INTERVIEW</option><option>DEMO_REVIEW</option><option>APPROVED</option><option>REJECTED</option></Select>
    <Area name="note" label={tr(fa, 'یادداشت', 'Review note')} />
    <div className="md:col-span-2"><Submit fa={fa} busy={action.isPending}>{tr(fa, 'اعمال وضعیت', 'Apply status')}</Submit></div>
  </form><Status fa={fa} error={action.error} ok={action.isSuccess} /></Shell>;
}

function AdminSettingsActions({ endpoint, fa }: { endpoint: string } & Localized) {
  const action = useAction(endpoint);
  return <div className="grid gap-5 xl:grid-cols-2">
    <Shell title={tr(fa, 'تنظیم عمومی', 'General setting')}><form className="mt-4 grid gap-4" onSubmit={(event) => {
      event.preventDefault(); const form = new FormData(event.currentTarget);
      action.mutate(() => api(`/admin/settings/${encodeURIComponent(value(form, 'key'))}`, { method: 'PUT', body: JSON.stringify({ value: { value: value(form, 'settingValue') }, public: form.get('public') === 'on' }) }));
    }}>
      <Field name="key" label={tr(fa, 'کلید', 'Key')} required dir="ltr" /><Field name="settingValue" label={tr(fa, 'مقدار', 'Value')} required />
      <label className="flex gap-2"><input name="public" type="checkbox" />{tr(fa, 'عمومی', 'Public')}</label>
      <Submit fa={fa} busy={action.isPending}>{tr(fa, 'ذخیره تنظیم', 'Save setting')}</Submit>
    </form><Status fa={fa} error={action.error} ok={action.isSuccess} /></Shell>
    <Shell title={tr(fa, 'صفحه محتوایی دو‌زبانه', 'Bilingual CMS page')}><form className="mt-4 grid gap-4" onSubmit={(event) => {
      event.preventDefault(); const form = new FormData(event.currentTarget);
      action.mutate(() => api(`/admin/cms/${encodeURIComponent(value(form, 'slug'))}`, { method: 'PUT', body: JSON.stringify({ titleFa: value(form, 'titleFa'), titleEn: value(form, 'titleEn'), contentFa: { paragraphs: [value(form, 'bodyFa')] }, contentEn: { paragraphs: [value(form, 'bodyEn')] }, published: true }) }));
    }}>
      <Field name="slug" label="Slug" required dir="ltr" />
      <Field name="titleFa" label={tr(fa, 'عنوان فارسی', 'Persian title')} required /><Field name="titleEn" label={tr(fa, 'عنوان انگلیسی', 'English title')} required dir="ltr" />
      <Area name="bodyFa" label={tr(fa, 'متن فارسی', 'Persian content')} required /><Area name="bodyEn" label={tr(fa, 'متن انگلیسی', 'English content')} required dir="ltr" />
      <Submit fa={fa} busy={action.isPending}>{tr(fa, 'ذخیره صفحه', 'Save page')}</Submit>
    </form></Shell>
  </div>;
}

function AdminBookingActions({ endpoint, fa }: { endpoint: string } & Localized) {
  const action = useAction(endpoint);
  return <Shell title={tr(fa, 'مسدودسازی تقویم توسط ادمین', 'Admin calendar block')}><form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={(event) => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    action.mutate(() => api('/availability/admin/blocks', { method: 'POST', body: JSON.stringify({ teacherId: value(form, 'teacherId'), startsAt: new Date(value(form, 'startsAt')).toISOString(), endsAt: new Date(value(form, 'endsAt')).toISOString(), reason: value(form, 'reason') || undefined }) }));
  }}>
    <ApprovedTeacherSelect fa={fa} />
    <Field name="startsAt" label={tr(fa, 'شروع', 'Starts at')} type="datetime-local" required /><Field name="endsAt" label={tr(fa, 'پایان', 'Ends at')} type="datetime-local" required />
    <Field name="reason" label={tr(fa, 'دلیل', 'Reason')} />
    <div className="md:col-span-2"><Submit fa={fa} busy={action.isPending}>{tr(fa, 'ثبت مسدودی', 'Create block')}</Submit></div>
  </form><Status fa={fa} error={action.error} ok={action.isSuccess} /></Shell>;
}

function AdminFinanceActions({ endpoint, fa }: { endpoint: string } & Localized) {
  const action = useAction(endpoint);
  return <div className="grid gap-5 xl:grid-cols-3">
    <Shell title={tr(fa, 'بازپرداخت', 'Refund')}><form className="mt-4 grid gap-4" onSubmit={(event) => {
      event.preventDefault(); const form = new FormData(event.currentTarget);
      action.mutate(() => api(`/payments/${value(form, 'paymentId')}/refunds`, { method: 'POST', body: JSON.stringify({ amount: numeric(form, 'amount'), reason: value(form, 'reason'), idempotencyKey: crypto.randomUUID() }) }));
    }}><PaymentSelect fa={fa}/><Field name="amount" label={tr(fa, 'مبلغ', 'Amount')} type="number" min={1} required /><Field name="reason" label={tr(fa, 'دلیل', 'Reason')} required /><Submit fa={fa} busy={action.isPending}>{tr(fa, 'ثبت بازپرداخت', 'Create refund')}</Submit></form><Status fa={fa} error={action.error} ok={action.isSuccess} /></Shell>
    <Shell title={tr(fa, 'کد تخفیف', 'Discount code')}><form className="mt-4 grid gap-4" onSubmit={(event) => {
      event.preventDefault(); const form = new FormData(event.currentTarget);
      action.mutate(() => api('/payouts/discounts', { method: 'POST', body: JSON.stringify({ code: value(form, 'code'), type: value(form, 'type'), value: numeric(form, 'discountValue'), maxUses: numeric(form, 'maxUses') || undefined }) }));
    }}><Field name="code" label={tr(fa, 'کد', 'Code')} required dir="ltr" /><Select name="type" label={tr(fa, 'نوع', 'Type')}><option value="percent">{tr(fa, 'درصد', 'Percent')}</option><option value="fixed">{tr(fa, 'مبلغ ثابت', 'Fixed amount')}</option></Select><Field name="discountValue" label={tr(fa, 'مقدار', 'Value')} type="number" min={1} required /><Field name="maxUses" label={tr(fa, 'حداکثر استفاده', 'Maximum uses')} type="number" min={1} /><Submit fa={fa} busy={action.isPending}>{tr(fa, 'ساخت تخفیف', 'Create discount')}</Submit></form></Shell>
    <Shell title={tr(fa, 'تولید تسویه هفتگی', 'Generate weekly payout')}><form className="mt-4 grid gap-4" onSubmit={(event) => {
      event.preventDefault(); const form = new FormData(event.currentTarget);
      action.mutate(() => api('/payouts/generate', { method: 'POST', body: JSON.stringify({ weekStart: value(form, 'weekStart'), weekEnd: value(form, 'weekEnd') }) }));
    }}><Field name="weekStart" label={tr(fa, 'شروع هفته', 'Week start')} type="date" required /><Field name="weekEnd" label={tr(fa, 'پایان هفته', 'Week end')} type="date" required /><Submit fa={fa} busy={action.isPending}>{tr(fa, 'تولید تسویه', 'Generate payout')}</Submit></form></Shell>
  </div>;
}

function AdminRoleActions({ endpoint, fa }: { endpoint: string } & Localized) {
  const action = useAction(endpoint);
  const form = (mode: 'assign' | 'revoke' | 'permission') => <form className="mt-4 grid gap-4" onSubmit={(event) => {
    event.preventDefault(); const data = new FormData(event.currentTarget); const userId = value(data, 'userId'); const role = value(data, 'role');
    const request = mode === 'assign' ? api('/admin/roles', { method: 'POST', body: JSON.stringify({ userId, role }) }) : mode === 'revoke' ? api('/admin/roles/revoke', { method: 'POST', body: JSON.stringify({ userId, role }) }) : api('/admin/permissions/grant', { method: 'POST', body: JSON.stringify({ userId, role, permission: value(data, 'permission') }) });
    action.mutate(() => request);
  }}>
    <AdminUserSelect fa={fa}/><Select name="role" label={tr(fa, 'نقش', 'Role')}><RoleOptions /></Select>
    {mode === 'permission' && <Field name="permission" label={tr(fa, 'کلید مجوز', 'Permission key')} defaultValue="reports.read" required dir="ltr" />}
    <Submit fa={fa} busy={action.isPending}>{mode === 'assign' ? tr(fa, 'افزودن نقش', 'Assign role') : mode === 'revoke' ? tr(fa, 'حذف نقش', 'Revoke role') : tr(fa, 'اعطای مجوز', 'Grant permission')}</Submit>
  </form>;
  return <div className="grid gap-5 xl:grid-cols-3"><Shell title={tr(fa, 'افزودن نقش', 'Assign role')}>{form('assign')}<Status fa={fa} error={action.error} ok={action.isSuccess} /></Shell><Shell title={tr(fa, 'حذف نقش', 'Revoke role')}>{form('revoke')}</Shell><Shell title={tr(fa, 'اعطای مجوز به نقش کاربر', 'Grant permission to user role')}>{form('permission')}</Shell></div>;
}

function RoleOptions() {
  return <><option>STUDENT</option><option>TEACHER</option><option>ADMIN</option><option>STAFF</option><option>EXAMINER</option><option>SUPPORT</option><option>FINANCE</option></>;
}
