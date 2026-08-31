import { ApiError, publicApi } from '@/shared/services/api';
import { ViewTracker } from '../view-tracker';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requestLocale } from '@/lib/server-locale';
import { formatNumber, localePath, localized, translate } from '@/lib/i18n';
import { Footer, Header } from '@/components/layout/site';
import { BlogDiscussion } from './blog-discussion';
import type { Metadata } from 'next';
import type { BlogPostDetail } from '@/features/blog/types';
import { publicPageMetadata } from '@/lib/public-metadata';

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
  let p: BlogPostDetail;
  try {
    p = await publicApi<BlogPostDetail>(`/blog/posts/${encodeURIComponent(slug)}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  if (!p) return <main className="p-12">{translate(locale, 'blogEmpty')}</main>;
  const title = localized({ fa: p.titleFa, en: p.titleEn }, locale);
  return (
    <>
      <Header />
      <main className="min-h-screen bg-canvas px-5 py-12">
        <ViewTracker id={p.id} />
        <div className="mx-auto max-w-3xl">
          <Link href={localePath('/blog', locale)} className="text-sm text-emerald-600">
            ← {translate(locale, 'blogBack')}
          </Link>
          <p className="mt-8 text-sm text-emerald-600">
            {localized({ fa: p.category?.nameFa, en: p.category?.nameEn }, locale)}
          </p>
          <h1 className="mt-3 text-4xl font-black leading-tight">{title}</h1>
          <p className="mt-4 text-lg text-slate-600">{localized({ fa: p.excerptFa, en: p.excerptEn }, locale)}</p>
          {p.coverImage && <img src={p.coverImage} alt={title} className="my-8 w-full rounded-2xl" />}
          <article className="prose prose-lg max-w-none whitespace-pre-wrap leading-9">
            {localized({ fa: p.contentFa, en: p.contentEn }, locale)}
          </article>
          <div className="mt-10 border-t pt-6 text-sm text-slate-500">
            {translate(locale, 'blogAuthor')}: {p.author?.name || translate(locale, 'blogDefaultAuthor')} ·{' '}
            {formatNumber(p._count?.views || 0, locale)} {translate(locale, 'blogViews')}
          </div>
          <BlogDiscussion postId={p.id} />
        </div>
      </main>
      <Footer />
    </>
  );
}
