import { isActiveNavigationPath } from './site';

describe('isActiveNavigationPath', () => {
  it('matches listing and detail paths without activating unrelated prefixes', () => {
    expect(isActiveNavigationPath('/teachers/sara', '/teachers')).toBe(true);
    expect(isActiveNavigationPath('/courses', '/courses')).toBe(true);
    expect(isActiveNavigationPath('/coursework', '/courses')).toBe(false);
    expect(isActiveNavigationPath('/teachers', '/')).toBe(false);
  });

  it('treats localized English routes as the same navigation destination', () => {
    expect(isActiveNavigationPath('/en/blog/article', '/en/blog')).toBe(true);
    expect(isActiveNavigationPath('/en', '/en')).toBe(true);
  });
});
