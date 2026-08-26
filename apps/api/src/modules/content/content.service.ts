import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { notFound } from '../../common';
import { Prisma } from '@prisma/client';

@Injectable()
export class ContentService {
  constructor(private readonly db: PrismaService) {}
  async publishedPage(slug: string) {
    const page = await this.db.cmsPage.findFirst({ where: { slug, published: true } });
    if (!page) throw notFound('PAGE_NOT_FOUND');
    return page;
  }

  list() {
    return this.db.cmsPage.findMany({ orderBy: { slug: 'asc' } });
  }

  upsert(slug: string, data: { titleFa?: string; titleEn?: string; contentFa?: unknown; contentEn?: unknown; seo?: unknown; published?: boolean }) {
    const titleFa = data.titleFa ?? slug;
    const titleEn = data.titleEn ?? slug;
    const contentFa = (data.contentFa ?? {}) as Prisma.InputJsonValue;
    const contentEn = (data.contentEn ?? {}) as Prisma.InputJsonValue;
    const seo = (data.seo ?? {}) as Prisma.InputJsonValue;
    const published = data.published === true;
    return this.db.cmsPage.upsert({
      where: { slug },
      create: { slug, titleFa, titleEn, contentFa, contentEn, seo, published },
      update: { titleFa, titleEn, contentFa, contentEn, seo, published },
    });
  }
}
