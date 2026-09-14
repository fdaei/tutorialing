import { BlogPostStatus, type PrismaClient } from '@prisma/client';
import { ENGLISH_POSTS } from './blog-content/english';
import { GERMAN_FRENCH_POSTS } from './blog-content/german-french';
import { SKILLS_POSTS } from './blog-content/skills';
import { STUDY_POSTS } from './blog-content/study';
import type { BlogSeedPost } from './blog-content/types';

// The editorial baseline for the public magazine at /blog: long-form,
// search-oriented guides so the site launches with real content instead of an
// empty list. Like cms-pages.seed.ts it lives outside seed.ts so production can
// install it on its own (seed-blog.ts) without the demo users and fixed OTP.

export const BLOG_CATEGORIES = [
  { slug: 'english', nameFa: 'آموزش زبان انگلیسی', nameEn: 'Learning English' },
  { slug: 'german', nameFa: 'آموزش زبان آلمانی', nameEn: 'Learning German' },
  { slug: 'french', nameFa: 'آموزش زبان فرانسه', nameEn: 'Learning French' },
  { slug: 'learning-tips', nameFa: 'نکات یادگیری', nameEn: 'Learning tips' },
  { slug: 'culture', nameFa: 'فرهنگ و زبان', nameEn: 'Culture & language' },
  { slug: 'exams-migration', nameFa: 'آزمون و مهاجرت', nameEn: 'Exams & migration' },
] as const;

export const BLOG_TAGS = [
  { slug: 'speaking', nameFa: 'مکالمه', nameEn: 'Speaking' },
  { slug: 'vocabulary', nameFa: 'واژگان', nameEn: 'Vocabulary' },
  { slug: 'study-plan', nameFa: 'برنامه‌ریزی', nameEn: 'Study plan' },
  { slug: 'grammar', nameFa: 'گرامر', nameEn: 'Grammar' },
  { slug: 'listening', nameFa: 'لیسنینگ', nameEn: 'Listening' },
  { slug: 'writing', nameFa: 'رایتینگ', nameEn: 'Writing' },
  { slug: 'pronunciation', nameFa: 'تلفظ', nameEn: 'Pronunciation' },
  { slug: 'ielts', nameFa: 'آیلتس', nameEn: 'IELTS' },
  { slug: 'immigration', nameFa: 'مهاجرت', nameEn: 'Immigration' },
  { slug: 'beginners', nameFa: 'مبتدی', nameEn: 'Beginners' },
  { slug: 'online-class', nameFa: 'کلاس آنلاین', nameEn: 'Online classes' },
] as const;

export const BLOG_POSTS: readonly BlogSeedPost[] = [
  ...ENGLISH_POSTS,
  ...GERMAN_FRENCH_POSTS,
  ...SKILLS_POSTS,
  ...STUDY_POSTS,
];

const DAY_MS = 24 * 60 * 60 * 1000;

export type SeedBlogPostsOptions = {
  authorId: string;
  // Dev seed replaces seeded rows; the production runner only fills gaps so
  // articles the editors have since changed from the panel are left alone.
  overwrite?: boolean;
  now?: Date;
};

export async function seedBlogPosts(db: PrismaClient, { authorId, overwrite = false, now = new Date() }: SeedBlogPostsOptions) {
  const categoryIds = new Map<string, string>();
  for (const category of BLOG_CATEGORIES) {
    const row = await db.blogCategory.upsert({ where: { slug: category.slug }, update: {}, create: category });
    categoryIds.set(category.slug, row.id);
  }
  const tagIds = new Map<string, string>();
  for (const tag of BLOG_TAGS) {
    const row = await db.blogTag.upsert({ where: { slug: tag.slug }, update: {}, create: tag });
    tagIds.set(tag.slug, row.id);
  }

  let written = 0;
  for (const [index, { category, tags, ...post }] of BLOG_POSTS.entries()) {
    const existing = await db.blogPost.findUnique({ where: { slug: post.slug }, select: { id: true } });
    if (existing && !overwrite) continue;

    const categoryId = categoryIds.get(category);
    if (!categoryId) throw new Error(`Blog post ${post.slug} references unknown category ${category}`);
    const tagRefs = tags.map((slug) => {
      const id = tagIds.get(slug);
      if (!id) throw new Error(`Blog post ${post.slug} references unknown tag ${slug}`);
      return { id };
    });
    // Stagger publication dates so the magazine reads as an archive, newest first.
    const publishedAt = new Date(now.getTime() - index * 3 * DAY_MS);
    const data = { ...post, categoryId, status: BlogPostStatus.PUBLISHED, publishedAt };

    await db.blogPost.upsert({
      where: { slug: post.slug },
      update: { ...data, tags: { set: tagRefs } },
      create: { ...data, authorId, tags: { connect: tagRefs } },
    });
    written += 1;
  }
  return written;
}
