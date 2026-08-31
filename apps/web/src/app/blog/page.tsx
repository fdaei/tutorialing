'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { publicApi } from '@/shared/services/api';
import { useTranslations } from '@/components/shared/locale-provider';
import { localePath, localized } from '@/lib/i18n';
import { Footer, Header } from '@/components/layout/site';
import { BookOpenText, RotateCcw, Search } from 'lucide-react';
import { useDebouncedValue } from '@/shared/hooks/use-debounced-value';
import type { BlogPostsPage } from '@/features/blog/types';

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
      <main className="page-shell py-10 md:py-14">
        <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="text-sm text-emerald-600">{t('blogEyebrow')}</p>
            <h1 className="mt-2 text-4xl font-black">{t('blogTitle')}</h1>
          </div>
          <label className="flex min-w-0 items-center gap-3 rounded-2xl border hairline bg-white px-4 shadow-sm md:w-80">
            <Search size={19} className="text-muted" />
            <input
              aria-label={t('blogSearch')}
              className="w-full bg-transparent py-3.5 outline-none"
              placeholder={t('blogSearch')}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
        </div>
        {posts.isPending ? (
          <div aria-label={t('blogLoading')} className="grid gap-5 md:grid-cols-3">
            {[1, 2, 3].map((x) => (
              <div key={x} className="skeleton h-72 rounded-3xl" />
            ))}
          </div>
        ) : posts.isError ? (
          <div className="review-empty">
            <BookOpenText aria-hidden="true" />
            <strong>دریافت مقاله‌ها ناموفق بود</strong>
            <p>اتصال خود را بررسی کنید و دوباره تلاش کنید.</p>
            <button type="button" className="secondary-button mt-2" onClick={() => posts.refetch()}>
              <RotateCcw size={17} aria-hidden="true" />
              تلاش دوباره
            </button>
          </div>
        ) : !posts.data?.items.length ? (
          <div className="review-empty min-h-[320px]">
            <span className="grid size-16 place-items-center rounded-2xl bg-lavender text-purple">
              <BookOpenText size={30} />
            </span>
            <strong className="text-xl">{search ? 'مقاله‌ای با این عبارت پیدا نشد' : 'هنوز مقاله‌ای منتشر نشده'}</strong>
            <p>
              {search ? 'عبارت کوتاه‌تر یا موضوع دیگری را امتحان کنید.' : 'به‌زودی مطالب آموزشی را اینجا می‌بینید.'}
            </p>
            {search ? (
              <button type="button" className="secondary-button mt-2" onClick={() => setQ('')}>
                پاک کردن جست‌وجو
              </button>
            ) : (
              <Link href={localePath('/courses', locale)} className="primary-button mt-2">
                مشاهده دوره‌ها
              </Link>
            )}
          </div>
        ) : (
          <div className="relative grid gap-6 md:grid-cols-3" aria-busy={posts.isFetching}>
            {posts.data.items.map((p) => (
              <Link
                href={localePath(`/blog/${p.slug}`, locale)}
                key={p.id}
                className="group rounded-2xl border bg-white p-4 shadow-sm transition hover:-translate-y-1"
              >
                <div
                  className="mb-4 aspect-[16/9] rounded-xl bg-slate-100 bg-cover bg-center"
                  style={{ backgroundImage: p.coverImage ? `url(${p.coverImage})` : undefined }}
                />
                <p className="text-xs text-emerald-600">
                  {localized({ fa: p.category?.nameFa, en: p.category?.nameEn }, locale)}
                </p>
                <h2 className="mt-2 text-xl font-bold group-hover:text-emerald-700">
                  {localized({ fa: p.titleFa, en: p.titleEn }, locale)}
                </h2>
                <p className="mt-2 line-clamp-2 text-sm text-slate-600">
                  {localized({ fa: p.excerptFa, en: p.excerptEn }, locale)}
                </p>
                <p className="mt-4 text-xs text-slate-400">{p.author?.name || t('blogDefaultAuthor')}</p>
              </Link>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
