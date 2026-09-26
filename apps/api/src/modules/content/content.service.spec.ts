import { ContentService } from './content.service';

describe('ContentService', () => {
  it('does not overwrite omitted CMS fields during a partial update', async () => {
    const upsert = jest.fn().mockResolvedValue({ slug: 'about' });
    const service = new ContentService({ cmsPage: { upsert } } as never);

    await service.upsert('about', { titleFa: 'درباره تازه' });

    expect(upsert).toHaveBeenCalledWith({
      where: { slug: 'about' },
      create: {
        slug: 'about',
        titleFa: 'درباره تازه',
        titleEn: 'about',
        contentFa: {},
        contentEn: {},
        seo: {},
        published: false,
      },
      update: { titleFa: 'درباره تازه' },
    });
  });

  // The sitemap is anonymous, so this query must stay narrow: drafts would leak
  // unreleased pages, and selecting the bodies would turn it into a bulk export.
  it('lists only published slugs and titles, without page bodies', async () => {
    const findMany = jest.fn().mockResolvedValue([{ slug: 'about', updatedAt: new Date(0) }]);
    const service = new ContentService({ cmsPage: { findMany } } as never);

    await expect(service.publishedSlugs()).resolves.toEqual([{ slug: 'about', updatedAt: new Date(0) }]);
    expect(findMany).toHaveBeenCalledWith({
      where: { published: true },
      select: { slug: true, titleFa: true, titleEn: true, updatedAt: true },
      orderBy: { slug: 'asc' },
    });
  });
});
