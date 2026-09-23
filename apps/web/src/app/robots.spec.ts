import { webConfig } from '@/config';
import robots from './robots';

jest.mock('@/config', () => ({ webConfig: { webUrl: 'https://lingospeak.example' } }));

const config = webConfig as { webUrl: string };

describe('robots', () => {
  afterEach(() => {
    config.webUrl = 'https://lingospeak.example';
  });

  it('points crawlers at the sitemap on a configured origin', () => {
    expect(robots()).toMatchObject({
      sitemap: 'https://lingospeak.example/sitemap.xml',
      host: 'https://lingospeak.example',
    });
  });

  it('disallows every private area in both locale spellings', () => {
    const { disallow } = robots().rules as { disallow: string[] };
    for (const prefix of ['/admin', '/panel', '/teacher-panel', '/dashboard', '/checkout', '/payment', '/auth']) {
      expect(disallow).toContain(`${prefix}/`);
      expect(disallow).toContain(`/en${prefix}/`);
    }
  });

  it('still allows the public site', () => {
    expect(robots().rules).toMatchObject({ userAgent: '*', allow: '/' });
  });

  it.each(['http://localhost:3000', 'http://127.0.0.1:3000'])(
    'blocks indexing entirely when the web URL is still the local default (%s)',
    (url) => {
      config.webUrl = url;
      expect(robots()).toEqual({ rules: { userAgent: '*', disallow: '/' } });
    },
  );
});
