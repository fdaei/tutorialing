import { adminNav, adminNavigationGroups, teacherNav } from './panel-shell';

describe('panel navigation architecture', () => {
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

  it('uses Magazine as the only editorial workspace and exposes instructor courses', () => {
    expect(adminNavigationGroups.find((group) => group.id === 'content')?.hrefs).toContain('/admin/magazine');
    expect(adminNav.some((item) => item.href.includes('community'))).toBe(false);
    expect(teacherNav.some((item) => item.href === '/teacher-panel/courses')).toBe(true);
  });

  it('contains only canonical product roles in navigation access rules', () => {
    const canonical = new Set(['STUDENT', 'INSTRUCTOR', 'SUPPORT', 'ADMIN']);
    expect(adminNav.flatMap((item) => item.roles ?? []).every((role) => canonical.has(role))).toBe(true);
  });
});
