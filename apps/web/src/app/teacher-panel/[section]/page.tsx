import { localized, isDefaultLocale, translate } from '@/lib/i18n';
import { PanelActions, PanelShell, ResourceView, teacherNav } from '@/features/panel';
import { TeacherAvailabilityManager, TeacherFinance, TeacherMore, TeacherProfileHub } from '@/features/teacher';
import { PricingManager } from '@/features/commerce';
import { MyTicketManager } from '@/features/support';
import { requestLocale } from '@/lib/server-locale';
import { TeacherPlannerCalendar } from '@/features/scheduling';
import { redirect } from 'next/navigation';
import { FeatureErrorBoundary } from '@/shared/components/error-boundaries';
import { InstructorArticleWorkspace } from '@/features/blog';
import { InstructorCourseWorkspace } from '@/features/courses';

const map: Record<string, [string, string, string]> = {
  profile: ['پروفایل عمومی', 'Public profile', '/teacher/application'],
  verification: ['وضعیت درخواست و احراز', 'Application and verification', '/teacher/application'],
  video: ['ویدیوی معرفی', 'Introduction video', '/teacher/application'],
  languages: ['زبان‌های آموزشی', 'Teaching languages', '/teacher/application'],
  specialties: ['تخصص‌ها و سطح‌ها', 'Specialties and levels', '/teacher/application'],
  availability: ['دسترسی هفتگی', 'Weekly availability', '/availability/me'],
  calendar: ['تقویم و مسدودی‌ها', 'Calendar and blocked periods', '/availability/me'],
  classes: ['کلاس‌ها', 'Classes', '/bookings/me'],
  students: ['زبان‌آموزان', 'Students', '/bookings/students'],
  plans: ['برنامه‌های یادگیری', 'Learning plans', '/learning/plans'],
  earnings: ['درآمد و تسویه', 'Earnings and payouts', '/teacher/finance'],
  tickets: ['تیکت‌ها', 'Tickets', '/support/tickets'],
  reviews: ['نظرات و امتیازها', 'Reviews and ratings', '/teacher/application'],
  notifications: ['اعلان‌ها', 'Notifications', '/notifications'],
  settings: ['تنظیمات', 'Settings', '/users/me'],
  magazine: ['مجله', 'Magazine', '/blog/instructor/posts'],
  courses: ['دوره‌های من', 'My courses', '/instructor/courses'],
};

export default async function Section({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const locale = await requestLocale(),
    fa = isDefaultLocale(locale);
  const [titleFa, titleEn, endpoint] = map[section] ?? ['پنل مدرس', 'Teacher panel', '/users/me'];
  if (['verification', 'video', 'languages', 'specialties'].includes(section))
    redirect(`/${translate(locale, 'teacherPanelsectionEn')}teacher-panel/profile`);
  if (section === 'calendar') redirect(`/${translate(locale, 'teacherPanelsectionEn')}teacher-panel/availability`);
  const content =
    section === 'profile' ? (
      <TeacherProfileHub />
    ) : section === 'availability' ? (
      <div className="grid gap-6">
        <TeacherPlannerCalendar />
        <TeacherAvailabilityManager />
      </div>
    ) : section === 'pricing' ? (
      <PricingManager mode="teacher" />
    ) : section === 'earnings' ? (
      <TeacherFinance />
    ) : section === 'magazine' ? (
      <InstructorArticleWorkspace />
    ) : section === 'courses' ? (
      <InstructorCourseWorkspace />
    ) : section === 'more' ? (
      <TeacherMore locale={locale} />
    ) : section === 'tickets' ? (
      <>
        <PanelActions role="teacher" section={section} endpoint={endpoint} />
        <MyTicketManager />
      </>
    ) : (
      <>
        <PanelActions role="teacher" section={section} endpoint={endpoint} />
        <ResourceView title={localized({ fa: titleFa, en: titleEn }, locale)} endpoint={endpoint} />
      </>
    );
  return (
    <PanelShell title="پنل مدرس" items={teacherNav}>
      <FeatureErrorBoundary name={`teacher-${section}`}>{content}</FeatureErrorBoundary>
    </PanelShell>
  );
}
