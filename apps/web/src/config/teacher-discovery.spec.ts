import { isLinkEnabled, isTeacherDiscoveryPath } from './index';

describe('teacher discovery gating', () => {
  it('recognizes teacher discovery paths in both locales', () => {
    for (const href of ['/teachers', '/teachers/arezoo-ahmadi', '/teachers?language=en', '/en/teachers', '/en/teachers/x', '/matching', '/en/matching']) {
      expect(isTeacherDiscoveryPath(href)).toBe(true);
    }
  });

  it('leaves unrelated paths alone, including teacher-adjacent ones', () => {
    for (const href of ['/', '/courses', '/teach', '/teach/register', '/teachers-guide', '/dashboard/matches', '/admin/teachers', '/en/courses']) {
      expect(isTeacherDiscoveryPath(href)).toBe(false);
    }
  });

  it('hides discovery links only while the flag is off', () => {
    expect(isLinkEnabled('/teachers', false)).toBe(false);
    expect(isLinkEnabled('/courses', false)).toBe(true);
    expect(isLinkEnabled('/teachers', true)).toBe(true);
  });
});
