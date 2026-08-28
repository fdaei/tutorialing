'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/shared/services/api';
import { useTranslations } from '@/components/shared/locale-provider';
import { localePath, localized } from '@/lib/i18n';
import { Footer, Header } from '@/components/layout/site';
import { BookOpenText, Search } from 'lucide-react';

export default function BlogPage() {
  const [data, setData] = useState<any>();
  const [q, setQ] = useState('');
  const [error, setError] = useState(false);
  const { locale, t } = useTranslations();
  useEffect(() => {
    setError(false);
    api<any>('/blog/posts?' + (q ? `search=${encodeURIComponent(q)}&` : '') + 'pageSize=12')
      .then(setData)
      .catch(() => {
        setError(true);
        setData({ items: [] });
      });
  }, [q]);
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
              className="w-full bg-transparent py-3.5 outline-none"
              placeholder={t('blogSearch')}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
        </div>
        {!data ? (
          <div aria-label={t('blogLoading')} className="grid gap-5 md:grid-cols-3">
            {[1, 2, 3].map((x) => (
              <div key={x} className="skeleton h-72 rounded-3xl" />
            ))}
          </div>
        ) : error ? (
          <div className="review-empty">
            <BookOpenText />
            <strong>دریافت مقاله‌ها ناموفق بود</strong>
            <p>اتصال خود را بررسی و صفحه را دوباره بارگذاری کنید.</p>
          </div>
        ) : !data.items?.length ? (
          <div className="review-empty min-h-[320px]">
            <span className="grid size-16 place-items-center rounded-2xl bg-lavender text-purple">
              <BookOpenText size={30} />
            </span>
            <strong className="text-xl">هنوز مقاله‌ای منتشر نشده</strong>
            <p>به‌زودی مطالب آموزشی و راهنمای یادگیری زبان را اینجا می‌بینید.</p>
            <Link href={localePath('/courses', locale)} className="primary-button mt-2">
              مشاهده دوره‌ها
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            {data.items.map((p: any) => (
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
