import { localized, isDefaultLocale } from '@/lib/i18n';
import { PanelActions, PanelShell, ResourceView, studentNav } from '@/features/panel';
import { MyTicketManager } from '@/features/support';
import { requestLocale } from '@/lib/server-locale';
import { StudentMatches, StudentProfile, StudentTests, StudentWallet } from '@/features/student';
import { TeacherPlannerCalendar } from '@/features/scheduling';
import { FeatureErrorBoundary } from '@/shared/components/error-boundaries';

const map: Record<string, [string, string, string]> = {
  classes: ['کلاس‌ها و تقویم', 'Classes and calendar', '/bookings/me'],
  tests: ['آزمون‌ها و نتایج', 'Tests and results', '/tests/attempts/history'],
  matches: ['مدرس‌های پیشنهادی', 'Recommended teachers', '/matching/history'],
  plan: ['برنامه یادگیری و تکلیف‌ها', 'Learning plan and assignments', '/learning/plans'],
  wallet: ['کیف پول و پرداخت‌ها', 'Wallet and payments', '/payments/wallet'],
  notifications: ['اعلان‌ها', 'Notifications', '/notifications'],
  tickets: ['تیکت‌های پشتیبانی', 'Support tickets', '/support/tickets'],
  profile: ['پروفایل و تنظیمات', 'Profile and settings', '/users/me'],
};

export default async function Section({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const locale = await requestLocale(),
    fa = isDefaultLocale(locale);
  const [titleFa, titleEn, endpoint] = map[section] ?? ['بخش موردنظر', 'Section', '/users/me'];
  return (
    <PanelShell title="پنل زبان‌آموز" items={studentNav}>
      <FeatureErrorBoundary name={`student-${section}`}>
      {section === 'tests' ? (
        <StudentTests />
      ) : section === 'classes' ? (
        <TeacherPlannerCalendar mode="student" />
      ) : section === 'matches' ? (
        <StudentMatches />
      ) : section === 'profile' ? (
        <StudentProfile />
      ) : section === 'wallet' ? (
        <StudentWallet />
      ) : section === 'tickets' ? (
        <MyTicketManager />
      ) : (
        <>
          <PanelActions role="student" section={section} endpoint={endpoint} />
          <ResourceView title={localized({ fa: titleFa, en: titleEn }, locale)} endpoint={endpoint} />
        </>
      )}
      </FeatureErrorBoundary>
    </PanelShell>
  );
}
