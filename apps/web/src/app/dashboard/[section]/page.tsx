import { PanelActions } from '@/components/panel-actions';
import { PanelShell, studentNav } from '@/components/panel-shell';
import { ResourceView } from '@/components/resource-view';
import { MyTicketManager } from '@/components/my-ticket-manager';
import {requestLocale} from '@/lib/server-locale';

const map: Record<string, [string,string, string]> = {
  classes: ['کلاس‌ها و تقویم','Classes and calendar', '/bookings/me'],
  tests: ['آزمون‌ها و نتایج','Tests and results', '/tests/attempts/history'],
  matches: ['مدرس‌های پیشنهادی','Recommended teachers', '/matching/history'],
  plan: ['برنامه یادگیری و تکلیف‌ها','Learning plan and assignments', '/learning/plans'],
  wallet: ['کیف پول و پرداخت‌ها','Wallet and payments', '/payments/wallet'],
  notifications: ['اعلان‌ها','Notifications', '/notifications'],
  tickets: ['تیکت‌های پشتیبانی','Support tickets', '/support/tickets'],
  profile: ['پروفایل و تنظیمات','Profile and settings', '/users/me'],
};

export default async function Section({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const locale=await requestLocale(),fa=locale==='fa';
  const [titleFa,titleEn, endpoint] = map[section] ?? ['بخش موردنظر','Section', '/users/me'];
  return <PanelShell title="پنل زبان‌آموز" items={studentNav}>
    <PanelActions role="student" section={section} endpoint={endpoint} />
    {section === 'tickets' ? <MyTicketManager /> : <ResourceView title={fa?titleFa:titleEn} endpoint={endpoint} />}
  </PanelShell>;
}
