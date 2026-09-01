import { adminNav, adminNavigationGroups, studentNav, teacherNav } from './panel-shell';
import { authPath } from '@/lib/i18n';
import { adminSectionConfig, isAdminSection } from '@/features/admin';
import { isStudentSection, isTeacherSection, studentSectionConfig, teacherSectionConfig } from '../panel-sections';

describe('panel navigation architecture', () => {
  it('preserves the localized panel destination when authentication expires', () => {
    expect(authPath('/en/teacher-panel/classes', 'en')).toBe('/en/auth?next=%2Fen%2Fteacher-panel%2Fclasses');
    expect(authPath('/dashboard/classes', 'fa')).toBe('/auth?next=%2Fdashboard%2Fclasses');
  });

  it('places every admin route in exactly one named group', () => {
    const grouped = adminNavigationGroups.flatMap((group) => [...group.hrefs]);
    expect(adminNavigationGroups.map((group) => group.id)).toEqual([
      'overview',
      'users',
      'learning',
      'content',
      'operations',
      'system',
    ]);
    expect(new Set(grouped).size).toBe(grouped.length);
    expect([...grouped].sort()).toEqual(adminNav.map((item) => item.href).sort());
  });

  it('maps every visible admin section and rejects unknown routes', () => {
    const sections = adminNav.map((item) => item.href.replace(/^\/admin\/?/, '')).filter(Boolean);
    expect(sections.every(isAdminSection)).toBe(true);
    expect(isAdminSection('anything')).toBe(false);
    expect(adminSectionConfig.languages[2]).toBe('/admin/languages');
    expect(adminSectionConfig.tickets[2]).toBe('/admin/tickets');
  });

  it('uses Magazine as the only editorial workspace and exposes instructor courses', () => {
    expect(adminNavigationGroups.find((group) => group.id === 'content')?.hrefs).toContain('/admin/magazine');
    expect(adminNav.some((item) => item.href.includes('community'))).toBe(false);
    expect(teacherNav.some((item) => item.href === '/teacher-panel/courses')).toBe(true);
  });

  it('contains only canonical product roles in navigation access rules', () => {
    const canonical = new Set(['STUDENT', 'INSTRUCTOR', 'SUPPORT', 'ADMIN']);
    expect(adminNav.flatMap((item) => item.roles ?? []).every((role) => canonical.has(role))).toBe(true);
  });

  it('maps every student and teacher navigation route and rejects unknown panel sections', () => {
    const sectionOf = (prefix: string, href: string) => href.replace(new RegExp(`^${prefix}/?`), '');
    const studentSections = studentNav.map((item) => sectionOf('/dashboard', item.href)).filter(Boolean);
    const teacherSections = teacherNav.map((item) => sectionOf('/teacher-panel', item.href)).filter(Boolean);

    expect(studentSections.every(isStudentSection)).toBe(true);
    expect(teacherSections.every(isTeacherSection)).toBe(true);
    expect(isStudentSection('anything')).toBe(false);
    expect(isTeacherSection('anything')).toBe(false);
    expect(studentSectionConfig.wallet[2]).toBe('/payments/wallet');
    expect(teacherSectionConfig.more[2]).toBe('/users/me');
  });
});
