import type { MetadataRoute } from 'next';
import { publicApi } from '@/shared/services/api';
import { featureFlags, webConfig } from '@/config';
import { localePath } from '@/lib/i18n';
import type { EducationalLanguage } from '@/features/languages';
import type { Course } from '@/lib/marketplace-data';
import type { PublicTeacher } from '@/features/teacher';
import type { Paginated } from '@/shared/services/api';

/**
 * Regenerated hourly. The sitemap is four public list calls; without a
 * revalidate window every crawler hit would fan out to the API.
 */
export const revalidate = 3600;

const TEACHER_PAGE_SIZE = 50;
const MAX_PAGES = 20;

type CmsPage = { slug: string; updatedAt: string };
type BlogSlug = { slug: string; publishedAt: string | null; updatedAt: string };

type Entry = MetadataRoute.Sitemap[number];

function absolute(path: string) {
  return new URL(path, webConfig.webUrl).toString();
}

/**
 * One entry per route, carrying both locales as hreflang alternates rather than
 * listing `/x` and `/en/x` as two competing URLs. The canonical stays the
 * Persian path, which is what `publicPageMetadata` emits on the pages
 * themselves — a sitemap that disagreed with the page would just be ignored.
 */
function entry(path: string, options: Omit<Entry, 'url' | 'alternates'> = {}): Entry {
  return {
    url: absolute(localePath(path, 'fa')),
    ...options,
    alternates: { languages: { 'fa-IR': absolute(localePath(path, 'fa')), en: absolute(localePath(path, 'en')) } },
  };
}

/** A missing date is left undefined: an invented `lastModified` teaches crawlers the wrong refresh rate. */
function lastModified(value?: string | null) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/**
 * The sitemap must not fail as a whole because one list endpoint is down —
 * a 500 here drops every URL from the index, which is worse than a short one.
 */
async function safely<T>(load: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await load();
  } catch {
    return fallback;
  }
}

function get<T>(path: string) {
  return publicApi<T>(path, { cache: 'force-cache', next: { revalidate } });
}

async function teachers() {
  const profiles: PublicTeacher[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const result = await get<Paginated<PublicTeacher>>(`/teachers?page=${page}&limit=${TEACHER_PAGE_SIZE}`);
    profiles.push(...result.data);
    if (page >= result.totalPages) break;
  }
  return profiles;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Only routes that render for a signed-out visitor belong here. Everything in
  // `ROUTE_RULES` (dashboard, checkout, placement, matching, teacher-apply)
  // needs an account, and teacher discovery is additionally feature-flagged —
  // while it is off, middleware 307s /teachers to /courses.
  const entries: Entry[] = [
    entry('/', { changeFrequency: 'daily', priority: 1 }),
    entry('/courses', { changeFrequency: 'daily', priority: 0.9 }),
    entry('/languages', { changeFrequency: 'weekly', priority: 0.8 }),
    entry('/blog', { changeFrequency: 'daily', priority: 0.8 }),
    entry('/teach', { changeFrequency: 'monthly', priority: 0.7 }),
  ];

  const [courses, languages, posts, pages, profiles] = await Promise.all([
    safely(() => get<Course[]>('/courses'), []),
    safely(() => get<EducationalLanguage[]>('/languages'), []),
    safely(() => get<BlogSlug[]>('/blog/posts/slugs'), []),
    safely(() => get<CmsPage[]>('/support/pages'), []),
    featureFlags.teacherDiscovery ? safely(teachers, [] as PublicTeacher[]) : Promise.resolve([] as PublicTeacher[]),
  ]);

  for (const course of courses)
    if (course.slug) entries.push(entry(`/courses/${course.slug}`, { changeFrequency: 'weekly', priority: 0.8 }));

  for (const language of languages)
    if (language.active && language.code)
      entries.push(entry(`/languages/${language.code}`, { changeFrequency: 'weekly', priority: 0.7 }));

  for (const post of posts)
    if (post.slug)
      entries.push(
        entry(`/blog/${post.slug}`, {
          lastModified: lastModified(post.publishedAt ?? post.updatedAt),
          changeFrequency: 'monthly',
          priority: 0.6,
        }),
      );

  // CMS pages are the marketing and legal routes served by `app/[slug]`, so
  // they are listed last: they change rarely and rank below the catalogue.
  for (const page of pages)
    if (page.slug)
      entries.push(
        entry(`/${page.slug}`, {
          lastModified: lastModified(page.updatedAt),
          changeFrequency: 'monthly',
          priority: 0.5,
        }),
      );

  if (featureFlags.teacherDiscovery) {
    entries.push(entry('/teachers', { changeFrequency: 'daily', priority: 0.9 }));
    for (const teacher of profiles)
      if (teacher.slug)
        entries.push(
          entry(`/teachers/${teacher.slug}`, {
            lastModified: lastModified(teacher.approvedAt),
            changeFrequency: 'weekly',
            priority: 0.7,
          }),
        );
  }

  return entries;
}
