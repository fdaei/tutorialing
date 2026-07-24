import { PanelActions } from '@/components/panel-actions';
import { PanelShell, teacherNav } from '@/components/panel-shell';
import { ResourceView } from '@/components/resource-view';
import { TeacherAvailabilityManager } from '@/components/teacher-availability-manager';
import { PricingManager } from '@/components/pricing-manager';
import { MyTicketManager } from '@/components/my-ticket-manager';
import {requestLocale} from '@/lib/server-locale';

const map: Record<string, [string,string, string]> = {
  profile: ['پروفایل عمومی','Public profile', '/teacher/application'],
  verification: ['وضعیت درخواست و احراز','Application and verification', '/teacher/application'],
  video: ['ویدیوی معرفی','Introduction video', '/teacher/application'],
  languages: ['زبان‌های آموزشی','Teaching languages', '/teacher/application'],
  specialties: ['تخصص‌ها و سطح‌ها','Specialties and levels', '/teacher/application'],
  availability: ['دسترسی هفتگی','Weekly availability', '/availability/me'],
  calendar: ['تقویم و مسدودی‌ها','Calendar and blocked periods', '/availability/me'],
  classes: ['کلاس‌ها','Classes', '/bookings/me'],
  students: ['زبان‌آموزان','Students', '/bookings/students'],
  plans: ['برنامه‌های یادگیری','Learning plans', '/learning/plans'],
  earnings: ['درآمد و تسویه','Earnings and payouts', '/teacher/finance'],
  tickets: ['تیکت‌ها','Tickets', '/support/tickets'],
  reviews: ['نظرات و امتیازها','Reviews and ratings', '/teacher/application'],
  notifications: ['اعلان‌ها','Notifications', '/notifications'],
  settings: ['تنظیمات','Settings', '/users/me'],
};

export default async function Section({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const locale=await requestLocale(),fa=locale==='fa';
  const [titleFa,titleEn, endpoint] = map[section] ?? ['پنل مدرس','Teacher panel', '/users/me'];
  const editable=['profile','verification','video','languages','specialties'];
  const content=section==='availability'||section==='calendar'?<TeacherAvailabilityManager/>:section==='pricing'?<PricingManager mode="teacher"/>:section==='tickets'?<><PanelActions role="teacher" section={section} endpoint={endpoint}/><MyTicketManager/></>:editable.includes(section)?<PanelActions role="teacher" section={section} endpoint={endpoint}/>:<><PanelActions role="teacher" section={section} endpoint={endpoint}/><ResourceView title={fa?titleFa:titleEn} endpoint={endpoint}/></>;
  return <PanelShell title="پنل مدرس" items={teacherNav}>{content}</PanelShell>;
}
