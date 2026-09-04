import { PUBLIC_CMS_PAGES } from '../../../prisma/cms-pages.seed';

// Production skips prisma/seed.ts, so this list is the only thing that puts
// the public content pages in the database. It was previously inline in that
// seed, which is why production served a 404 on every footer link.
const linkedFromTheSite = [
  'about',
  'how-it-works',
  'faq',
  'contact',
  'terms',
  'privacy',
  'cancellation-policy',
  'become-a-teacher',
];

describe('public CMS page baseline', () => {
  const slugs = PUBLIC_CMS_PAGES.map((page) => page.slug);

  it.each(linkedFromTheSite)('covers %s, which the site links to', (slug) => {
    expect(slugs).toContain(slug);
  });

  it('has no duplicate slugs, so the upsert order cannot matter', () => {
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('gives every page a title and at least one paragraph in both locales', () => {
    for (const page of PUBLIC_CMS_PAGES) {
      expect(page.titleFa.trim()).not.toHaveLength(0);
      expect(page.titleEn.trim()).not.toHaveLength(0);
      expect(page.contentFa.paragraphs.length).toBeGreaterThan(0);
      expect(page.contentEn.paragraphs.length).toBeGreaterThan(0);
    }
  });
});
