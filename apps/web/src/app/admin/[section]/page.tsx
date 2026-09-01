import { localized, isDefaultLocale } from '@/lib/i18n';
import { notFound } from 'next/navigation';
import { PanelActions, PanelShell, ResourceView, adminNav } from '@/features/panel';
import {
  AdminFinanceCenter,
  AdminTestManager,
  AdminUsersManager,
  CountryManager,
  ExaminerReviewManager,
  LanguageManager,
  adminSectionConfig,
  isAdminSection,
  TeacherDocumentsManager,
} from '@/features/admin';
import { TicketManager } from '@/features/support';
import { PricingManager } from '@/features/commerce';
import { requestLocale } from '@/lib/server-locale';
import { TeacherPlannerCalendar } from '@/features/scheduling';
import { FeatureErrorBoundary } from '@/shared/components/error-boundaries';
import { AdminArticleReviewWorkspace } from '@/features/blog';

export default async function Section({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!isAdminSection(section)) notFound();
  const locale = await requestLocale(),
    fa = isDefaultLocale(locale);
  const [titleFa, titleEn, endpoint] = adminSectionConfig[section];
  let content: React.ReactNode;
  if (section === 'tests') content = <AdminTestManager />;
  else if (section === 'bookings')
    content = (
      <div className="grid gap-6">
        <TeacherPlannerCalendar mode="admin" />
        <PanelActions role="admin" section={section} endpoint={endpoint} />
        <ResourceView title={localized({ fa: titleFa, en: titleEn }, locale)} endpoint={endpoint} />
      </div>
    );
  else if (section === 'users')
    content = (
      <>
        <PanelActions role="admin" section={section} endpoint={endpoint} />
        <AdminUsersManager />
      </>
    );
  else if (section === 'test-reviews') content = <ExaminerReviewManager />;
  else if (section === 'tickets') content = <TicketManager />;
  else if (section === 'languages') content = <LanguageManager />;
  else if (section === 'countries') content = <CountryManager />;
  else if (section === 'teacher-prices') content = <PricingManager mode="admin" />;
  else if (section === 'teacher-documents') content = <TeacherDocumentsManager />;
  else if (section === 'finance' || section === 'teacher-earnings') content = <AdminFinanceCenter />;
  else if (section === 'payouts')
    content = (
      <div className="grid gap-6">
        <PanelActions role="admin" section={section} endpoint={endpoint} />
        <AdminFinanceCenter />
      </div>
    );
  else if (section === 'magazine') content = <AdminArticleReviewWorkspace />;
  else
    content = (
      <>
        <PanelActions role="admin" section={section} endpoint={endpoint} />
        <ResourceView title={localized({ fa: titleFa, en: titleEn }, locale)} endpoint={endpoint} />
      </>
    );
  return (
    <PanelShell title="مدیریت لینگواسپیک" items={adminNav}>
      <FeatureErrorBoundary name={`admin-${section}`}>{content}</FeatureErrorBoundary>
    </PanelShell>
  );
}
