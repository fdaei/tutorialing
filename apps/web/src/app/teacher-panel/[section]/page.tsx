import { localized, isDefaultLocale, translate } from '@/lib/i18n';
import {
  isTeacherSection,
  PanelActions,
  PanelShell,
  ResourceView,
  teacherNav,
  teacherSectionConfig,
} from '@/features/panel';
import { TeacherAvailabilityManager, TeacherFinance, TeacherMore, TeacherProfileHub } from '@/features/teacher';
import { PricingManager } from '@/features/commerce';
import { MyTicketManager } from '@/features/support';
import { requestLocale } from '@/lib/server-locale';
import { TeacherPlannerCalendar } from '@/features/scheduling';
import { notFound, redirect } from 'next/navigation';
import { FeatureErrorBoundary } from '@/shared/components/error-boundaries';
import { InstructorArticleWorkspace } from '@/features/blog';
import { InstructorCourseWorkspace } from '@/features/courses';

export default async function Section({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!isTeacherSection(section)) notFound();
  const locale = await requestLocale(),
    fa = isDefaultLocale(locale);
  const [titleFa, titleEn, endpoint] = teacherSectionConfig[section];
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
