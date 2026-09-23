import { publicApi } from '@/shared/services/api';
import { featureFlags } from '@/config';
import sitemap from './sitemap';

jest.mock('@/shared/services/api', () => ({
  ...jest.requireActual('@/shared/services/api'),
  publicApi: jest.fn(),
}));
jest.mock('@/config', () => ({
  webConfig: { webUrl: 'https://lingospeak.example' },
  featureFlags: { teacherDiscovery: false },
}));

const mockedApi = jest.mocked(publicApi);
const flags = featureFlags as { teacherDiscovery: boolean };

/** Answers each endpoint from a fixture table so tests state only what they care about. */
function respondWith(routes: Record<string, unknown>) {
  mockedApi.mockImplementation((path: string) => {
    const key = Object.keys(routes).find((prefix) => path.startsWith(prefix));
    if (!key) throw new Error(`unexpected request: ${path}`);
    return Promise.resolve(routes[key] as never);
  });
}

const EMPTY = {
  '/courses': [],
  '/languages': [],
  '/blog/posts/slugs': [],
  '/support/pages': [],
  '/teachers': { data: [], total: 0, page: 1, totalPages: 0 },
};

const urls = (entries: Awaited<ReturnType<typeof sitemap>>) => entries.map((entry) => entry.url);

describe('sitemap', () => {
  beforeEach(() => {
    flags.teacherDiscovery = false;
    mockedApi.mockReset();
  });

  it('lists the public marketing routes as absolute URLs', async () => {
    respondWith(EMPTY);
    expect(urls(await sitemap())).toEqual([
      'https://lingospeak.example/',
      'https://lingospeak.example/courses',
      'https://lingospeak.example/languages',
      'https://lingospeak.example/blog',
      'https://lingospeak.example/teach',
    ]);
  });

  it('never advertises a route that requires an account', async () => {
    respondWith(EMPTY);
    const listed = urls(await sitemap()).join(' ');
    for (const gated of ['/dashboard', '/panel', '/admin', '/checkout', '/placement', '/matching', '/teacher-apply'])
      expect(listed).not.toContain(gated);
  });

  it('carries both locales as hreflang alternates instead of duplicate URLs', async () => {
    respondWith(EMPTY);
    const home = (await sitemap()).find((entry) => entry.url === 'https://lingospeak.example/');
    expect(home?.alternates?.languages).toEqual({
      'fa-IR': 'https://lingospeak.example/',
      en: 'https://lingospeak.example/en',
    });
  });

  it('includes published courses, active languages and blog posts', async () => {
    respondWith({
      ...EMPTY,
      '/courses': [{ slug: 'ielts-intensive' }, { slug: 'german-a1' }],
      '/languages': [
        { code: 'en', active: true },
        { code: 'de', active: false },
      ],
      '/blog/posts/slugs': [{ slug: 'first-post', publishedAt: '2026-01-15T00:00:00Z' }],
    });
    const entries = await sitemap();
    const listed = urls(entries);
    expect(listed).toContain('https://lingospeak.example/courses/ielts-intensive');
    expect(listed).toContain('https://lingospeak.example/languages/en');
    expect(listed).not.toContain('https://lingospeak.example/languages/de');
    expect(entries.find((entry) => entry.url.endsWith('/blog/first-post'))?.lastModified).toEqual(
      new Date('2026-01-15T00:00:00Z'),
    );
  });

  it('includes published CMS pages at the root path', async () => {
    respondWith({ ...EMPTY, '/support/pages': [{ slug: 'about-us', updatedAt: '2026-03-02T00:00:00Z' }] });
    const entries = await sitemap();
    const about = entries.find((item) => item.url === 'https://lingospeak.example/about-us');
    expect(about?.lastModified).toEqual(new Date('2026-03-02T00:00:00Z'));
    expect(about?.alternates?.languages).toMatchObject({ en: 'https://lingospeak.example/en/about-us' });
  });

  it('omits teacher profiles while teacher discovery is flagged off', async () => {
    respondWith({ ...EMPTY, '/teachers': { data: [{ slug: 'sara' }], total: 1, page: 1, totalPages: 1 } });
    const listed = urls(await sitemap()).join(' ');
    expect(listed).not.toContain('/teachers');
    expect(mockedApi).not.toHaveBeenCalledWith(expect.stringContaining('/teachers'), expect.anything());
  });

  it('includes the directory and every profile once the flag is on', async () => {
    flags.teacherDiscovery = true;
    respondWith({
      ...EMPTY,
      '/teachers': { data: [{ slug: 'sara', approvedAt: '2026-02-01T00:00:00Z' }], total: 1, page: 1, totalPages: 1 },
    });
    const listed = urls(await sitemap());
    expect(listed).toContain('https://lingospeak.example/teachers');
    expect(listed).toContain('https://lingospeak.example/teachers/sara');
  });

  it('falls back to updatedAt for a post with no publish date', async () => {
    respondWith({
      ...EMPTY,
      '/blog/posts/slugs': [{ slug: 'legacy', publishedAt: null, updatedAt: '2026-04-05T00:00:00Z' }],
    });
    const post = (await sitemap()).find((entry) => entry.url.endsWith('/blog/legacy'));
    expect(post?.lastModified).toEqual(new Date('2026-04-05T00:00:00Z'));
  });

  it('still returns the static routes when a list endpoint is down', async () => {
    mockedApi.mockRejectedValue(new Error('api down'));
    expect(urls(await sitemap())).toEqual([
      'https://lingospeak.example/',
      'https://lingospeak.example/courses',
      'https://lingospeak.example/languages',
      'https://lingospeak.example/blog',
      'https://lingospeak.example/teach',
    ]);
  });
});
