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
});
