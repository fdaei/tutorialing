import { ApiError, publicApi } from '@/shared/services/api';
import { ViewTracker } from '../view-tracker';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, BookOpenText, CalendarDays, Clock3, MessageCircle, UserRound } from 'lucide-react';
import { requestLocale } from '@/lib/server-locale';
import { formatNumber, localePath, localized, translate } from '@/lib/i18n';
import { Footer, Header } from '@/components/layout/site';
import { BlogDiscussion } from './blog-discussion';
import { BlogMarkdown } from '@/features/blog/components/blog-markdown';
import type { BlogPostDetail, BlogPostSummary, BlogPostsPage } from '@/features/blog/types';
import type { Metadata } from 'next';
import { publicPageMetadata } from '@/lib/public-metadata';

const copy = (locale: 'fa' | 'en', fa: string, en: string) => (locale === 'en' ? en : fa);

function formatDate(value: string | null | undefined, locale: 'fa' | 'en') {
  if (!value) return copy(locale, 'تاریخ انتشار', 'Published recently');
  return new Date(value).toLocaleDateString(locale === 'en' ? 'en-US' : 'fa-IR-u-ca-persian', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  try {
    const post = await publicApi<BlogPostDetail>(`/blog/posts/${encodeURIComponent(slug)}`);
    return publicPageMetadata(
      `/blog/${slug}`,
      { fa: post.seoTitleFa || post.titleFa, en: post.seoTitleEn || post.titleEn },
      {
        fa: post.seoDescriptionFa || post.excerptFa,
        en: post.seoDescriptionEn || post.excerptEn,
      },
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return {};
    throw error;
  }
}

export default async function BlogDetail({ params }: { params: Promise<{ slug: string }> }) {
  const [{ slug }, locale] = await Promise.all([params, requestLocale()]);
  let post: BlogPostDetail;
  try {
    post = await publicApi<BlogPostDetail>(`/blog/posts/${encodeURIComponent(slug)}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const relatedResponse = await publicApi<BlogPostsPage>('/blog/posts?pageSize=6').catch(() => ({ items: [], page: 1, pageSize: 0 }));
  const related = relatedResponse.items.filter((item) => item.slug !== post.slug).slice(0, 3);
  const title = localized({ fa: post.titleFa, en: post.titleEn }, locale);
  const category = localized({ fa: post.category?.nameFa, en: post.category?.nameEn }, locale) || copy(locale, 'یادگیری زبان', 'Language learning');
  const author = post.author?.name || translate(locale, 'blogDefaultAuthor');
  const readingTime = post.readingTimeMinutes ?? 1;

  return (
    <>
      <Header />
      <main className="blog-article-page">
        <ViewTracker id={post.id} />
        <section className="blog-article-hero">
          <div className="page-shell">
            <Link href={localePath('/blog', locale)} className="blog-back-link">
              <ArrowRight size={17} aria-hidden="true" />
              {translate(locale, 'blogBack')}
            </Link>
            <div className="blog-article-hero-grid">
              <div className="blog-article-intro">
                <span className="blog-category blog-category-hero">{category}</span>
                <h1>{title}</h1>
                <p className="blog-article-excerpt">{localized({ fa: post.excerptFa, en: post.excerptEn }, locale)}</p>
                <div className="blog-article-meta">
                  <span><UserRound size={16} aria-hidden="true" />{author}</span>
                  <span><CalendarDays size={16} aria-hidden="true" />{formatDate(post.publishedAt, locale)}</span>
                  <span><Clock3 size={16} aria-hidden="true" />{readingTime.toLocaleString(locale === 'en' ? 'en-US' : 'fa-IR')} {copy(locale, 'دقیقه مطالعه', 'min read')}</span>
                </div>
              </div>
              <div className="blog-article-cover">
                {post.coverImage ? (
                  <img src={post.coverImage} alt="" />
                ) : (
                  <div className="blog-article-cover-placeholder">
                    <BookOpenText size={56} aria-hidden="true" />
                    <span>{category}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <div className="page-shell blog-article-layout">
          <article className="blog-reading-column">
            <BlogMarkdown content={localized({ fa: post.contentFa, en: post.contentEn }, locale)} />
            <div className="blog-article-stats">
              <span><MessageCircle size={16} aria-hidden="true" />{formatNumber(post._count?.comments || 0, locale)} {copy(locale, 'دیدگاه', 'comments')}</span>
              <span>{formatNumber(post._count?.views || 0, locale)} {translate(locale, 'blogViews')}</span>
            </div>
          </article>

          <aside className="blog-article-aside">
            <Link href={localePath('/blog', locale)} className="blog-aside-back">
              <ArrowRight size={17} aria-hidden="true" />
              {translate(locale, 'blogBack')}
            </Link>
            <div className="blog-aside-note">
              <span><BookOpenText size={18} aria-hidden="true" /></span>
              <strong>{copy(locale, 'یادگیری با یک قدم کوچک شروع می‌شود.', 'Learning starts with one small step.')}</strong>
              <p>{copy(locale, 'مقاله را ذخیره کنید و ایده‌اش را همین هفته امتحان کنید.', 'Save the idea and try it this week.')}</p>
            </div>
          </aside>
        </div>

        <div className="page-shell">
          <BlogDiscussion postId={post.id} />
          {related.length > 0 && (
            <section className="blog-related">
              <div className="blog-related-heading">
                <div>
                  <span className="blog-section-label">{copy(locale, 'برای مطالعه بعدی', 'Keep reading')}</span>
                  <h2>{copy(locale, 'مطالب مرتبط', 'Related articles')}</h2>
                </div>
                <Link href={localePath('/blog', locale)} className="blog-card-link">
                  {copy(locale, 'همه مقاله‌ها', 'All articles')} <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </div>
              <div className="blog-related-grid">
                {related.map((item) => <RelatedArticleCard key={item.id} post={item} locale={locale} />)}
              </div>
            </section>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}

function RelatedArticleCard({ post, locale }: { post: BlogPostSummary; locale: 'fa' | 'en' }) {
  const title = localized({ fa: post.titleFa, en: post.titleEn }, locale);
  return (
    <Link href={localePath(`/blog/${post.slug}`, locale)} className="blog-related-card">
      <div className="blog-related-image">
        {post.coverImage ? <img src={post.coverImage} alt="" /> : <BookOpenText size={28} aria-hidden="true" />}
      </div>
      <div>
        <span className="blog-category">{localized({ fa: post.category?.nameFa, en: post.category?.nameEn }, locale) || copy(locale, 'یادگیری زبان', 'Language learning')}</span>
        <h3>{title}</h3>
        <span className="blog-card-link">{copy(locale, 'مطالعه مقاله', 'Read article')} <ArrowRight size={15} aria-hidden="true" /></span>
      </div>
    </Link>
  );
}
