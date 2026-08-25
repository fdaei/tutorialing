import { PanelShell, teacherNav } from '@/features/panel/components/panel-shell';
import { TeacherDashboard } from '@/features/teacher/components/teacher-dashboard';
export default function TeacherHome() {
  return (
    <PanelShell title="پنل مدرس" items={teacherNav}>
      <TeacherDashboard />
    </PanelShell>
  );
}
