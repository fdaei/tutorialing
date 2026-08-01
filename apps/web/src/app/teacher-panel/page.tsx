import{PanelShell,teacherNav}from'@/components/panel-shell';
import{TeacherDashboard}from'@/components/teacher-dashboard';
export default function TeacherHome(){return <PanelShell title="پنل مدرس" items={teacherNav}><TeacherDashboard/></PanelShell>}
