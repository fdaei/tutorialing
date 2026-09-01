import { localized, isDefaultLocale } from '@/lib/i18n';
import {
  isStudentSection,
  PanelActions,
  PanelShell,
  ResourceView,
  studentNav,
  studentSectionConfig,
} from '@/features/panel';
import { MyTicketManager } from '@/features/support';
import { requestLocale } from '@/lib/server-locale';
import { StudentMatches, StudentProfile, StudentTests, StudentWallet } from '@/features/student';
import { TeacherPlannerCalendar } from '@/features/scheduling';
import { FeatureErrorBoundary } from '@/shared/components/error-boundaries';
import { MyCourses } from '@/features/courses';
import { notFound } from 'next/navigation';

export default async function Section({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!isStudentSection(section)) notFound();
  const locale = await requestLocale(),
    fa = isDefaultLocale(locale);
  const [titleFa, titleEn, endpoint] = studentSectionConfig[section];
  return (
    <PanelShell title="پنل زبان‌آموز" items={studentNav}>
      <FeatureErrorBoundary name={`student-${section}`}>
        {section === 'tests' ? (
          <StudentTests />
        ) : section === 'courses' ? (
          <MyCourses />
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
