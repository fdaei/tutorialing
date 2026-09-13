'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpLeft, BookOpenText, CalendarDays, Clock3, RotateCcw, Search, Sparkles, UserRound, X } from 'lucide-react';
import { publicApi } from '@/shared/services/api';
import { useTranslations } from '@/components/shared/locale-provider';
import { localePath, localized } from '@/lib/i18n';
import { Footer, Header } from '@/components/layout/site';
import { useDebouncedValue } from '@/shared/hooks/use-debounced-value';
import type { BlogPostSummary, BlogPostsPage } from '@/features/blog/types';

const copy = (locale: 'fa' | 'en', fa: string, en: string) => (locale === 'en' ? en : fa);

function formatDate(value: string | null | undefined, locale: 'fa' | 'en') {
  if (!value) return copy(locale, 'تاریخ انتشار', 'Published recently');
  return new Date(value).toLocaleDateString(locale === 'en' ? 'en-US' : 'fa-IR-u-ca-persian', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function readingTime(post: BlogPostSummary, locale: 'fa' | 'en') {
  const minutes = post.readingTimeMinutes ?? 1;
  return `${minutes.toLocaleString(locale === 'en' ? 'en-US' : 'fa-IR')} ${copy(locale, 'دقیقه مطالعه', 'min read')}`;
}

export default function BlogPage() {
  const [q, setQ] = useState('');
  const { locale, t } = useTranslations();
  const search = useDebouncedValue(q.trim(), 350);
  const posts = useQuery({
    queryKey: ['public-blog-posts', search],
    queryFn: ({ signal }) =>
      publicApi<BlogPostsPage>(`/blog/posts?${search ? `search=${encodeURIComponent(search)}&` : ''}pageSize=12`, {
        signal,
      }),
    placeholderData: (previous) => previous,
  });

  return (
    <>
      <Header />
      <main className="blog-page">
        <section className="blog-hero">
          <div className="page-shell blog-hero-inner">
            <div className="blog-hero-copy">
              <span className="blog-kicker">
                <Sparkles size={15} aria-hidden="true" />
                {t('blogEyebrow')}
              </span>
              <h1>{t('blogTitle')}</h1>
              <p>
                {copy(
                  locale,
                  'راهنمایی‌های کوتاه و کاربردی برای اینکه بین کلاس‌ها هم با اطمینان جلو بروید.',
                  'Short, useful ideas to help you keep moving between lessons.',
                )}
              </p>
            </div>
            <div className="blog-search-wrap">
              <label className="blog-search">
                <Search size={20} aria-hidden="true" />
                <input
                  aria-label={t('blogSearch')}
                  placeholder={copy(locale, 'جست‌وجو در مقاله‌ها', 'Search the journal')}
                  value={q}
                  onChange={(event) => setQ(event.target.value)}
                />
                {q && (
                  <button type="button" onClick={() => setQ('')} aria-label={copy(locale, 'پاک کردن جست‌وجو', 'Clear search')}>
                    <X size={17} aria-hidden="true" />
                  </button>
                )}
              </label>
              <span>{copy(locale, 'یادگیری روشن‌تر، قدم‌به‌قدم', 'Clearer learning, one useful step at a time')}</span>
            </div>
          </div>
        </section>

        <section className="page-shell blog-results">
          <div className="blog-results-heading">
            <div>
              <span className="blog-section-label">{copy(locale, 'آخرین نوشته‌ها', 'Latest notes')}</span>
              <h2>{search ? copy(locale, 'نتیجه جست‌وجو', 'Search results') : copy(locale, 'برای مسیر یادگیری شما', 'For your learning route')}</h2>
            </div>
            {!posts.isPending && !posts.isError && posts.data?.items.length ? (
              <span className="blog-results-count">
                {posts.data.items.length.toLocaleString(locale === 'en' ? 'en-US' : 'fa-IR')} {copy(locale, 'مقاله', 'articles')}
              </span>
            ) : null}
          </div>

          {posts.isPending ? (
            <div aria-label={t('blogLoading')} className="blog-grid">
              {[1, 2, 3].map((item) => (
                <div key={item} className={`blog-card-skeleton ${item === 1 ? 'blog-card-skeleton-featured' : ''}`}>
                  <div className="skeleton blog-card-skeleton-image" />
                  <div className="grid gap-3 p-5">
                    <div className="skeleton h-3 w-24 rounded-full" />
                    <div className="skeleton h-6 w-4/5 rounded-full" />
                    <div className="skeleton h-4 w-full rounded-full" />
                    <div className="skeleton h-4 w-2/3 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : posts.isError ? (
            <div className="blog-empty-state">
              <span className="blog-empty-icon"><BookOpenText size={28} /></span>
              <strong>{copy(locale, 'دریافت مقاله‌ها ناموفق بود', 'The journal could not be loaded')}</strong>
              <p>{copy(locale, 'اتصال خود را بررسی کنید و دوباره تلاش کنید.', 'Check your connection and try again.')}</p>
              <button type="button" className="secondary-button" onClick={() => posts.refetch()}>
                <RotateCcw size={17} aria-hidden="true" />
                {copy(locale, 'تلاش دوباره', 'Try again')}
              </button>
            </div>
          ) : !posts.data?.items.length ? (
            <div className="blog-empty-state">
              <span className="blog-empty-icon"><BookOpenText size={28} /></span>
              <strong>{search ? copy(locale, 'مقاله‌ای با این عبارت پیدا نشد', 'No articles matched that search') : copy(locale, 'هنوز مقاله‌ای منتشر نشده', 'No articles have been published yet')}</strong>
              <p>{search ? copy(locale, 'عبارت کوتاه‌تر یا موضوع دیگری را امتحان کنید.', 'Try a shorter phrase or another topic.') : copy(locale, 'به‌زودی مطالب آموزشی را اینجا می‌بینید.', 'Learning notes will appear here soon.')}</p>
              {search ? (
                <button type="button" className="secondary-button" onClick={() => setQ('')}>
                  {copy(locale, 'پاک کردن جست‌وجو', 'Clear search')}
                </button>
              ) : (
                <Link href={localePath('/courses', locale)} className="primary-button">
                  {copy(locale, 'مشاهده دوره‌ها', 'Explore courses')}
                </Link>
              )}
            </div>
          ) : (
            <div className="blog-grid" aria-busy={posts.isFetching}>
              {posts.data.items.map((post, index) => <BlogCard key={post.id} post={post} locale={locale} featured={index === 0} />)}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}

function BlogCard({ post, locale, featured }: { post: BlogPostSummary; locale: 'fa' | 'en'; featured?: boolean }) {
  const title = localized({ fa: post.titleFa, en: post.titleEn }, locale);
  const category = localized({ fa: post.category?.nameFa, en: post.category?.nameEn }, locale) || copy(locale, 'یادگیری زبان', 'Language learning');
  return (
    <Link href={localePath(`/blog/${post.slug}`, locale)} className={`blog-card ${featured ? 'blog-card-featured' : ''}`}>
      <BlogCover post={post} title={title} featured={featured} />
      <div className="blog-card-body">
        <div className="blog-card-category-row">
          <span className="blog-category">{category}</span>
          {featured && <span className="blog-featured-label">{copy(locale, 'پیشنهاد سردبیر', "Editor's pick")}</span>}
        </div>
        <h3>{title}</h3>
        <p className="blog-card-excerpt">{localized({ fa: post.excerptFa, en: post.excerptEn }, locale)}</p>
        <div className="blog-card-meta">
          <span><UserRound size={14} aria-hidden="true" />{post.author?.name || copy(locale, 'تیم لینگواسپیک', 'LingoSpeak team')}</span>
          <span><CalendarDays size={14} aria-hidden="true" />{formatDate(post.publishedAt, locale)}</span>
          <span><Clock3 size={14} aria-hidden="true" />{readingTime(post, locale)}</span>
        </div>
        <span className="blog-card-link">{copy(locale, 'مطالعه مقاله', 'Read article')} <ArrowUpLeft size={16} aria-hidden="true" /></span>
      </div>
    </Link>
  );
}

function BlogCover({ post, title, featured }: { post: BlogPostSummary; title: string; featured?: boolean }) {
  return (
    <div className={`blog-card-cover ${featured ? 'blog-card-cover-featured' : ''}`}>
      {post.coverImage ? (
        <img src={post.coverImage} alt="" />
      ) : (
        <div className="blog-cover-placeholder">
          <span className="blog-cover-mark"><BookOpenText size={featured ? 38 : 30} aria-hidden="true" /></span>
          <span>{title.slice(0, 1)}</span>
        </div>
      )}
      <span className="blog-cover-shade" />
    </div>
  );
}
