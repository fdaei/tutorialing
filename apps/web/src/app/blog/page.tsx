'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useTranslations } from '@/components/shared/locale-provider';
import { localePath, localized } from '@/lib/i18n';

export default function BlogPage() {
  const [data, setData] = useState<any>();
  const [q, setQ] = useState('');
  const { locale, t } = useTranslations();
  useEffect(() => {
    api<any>('/blog/posts?' + (q ? `search=${encodeURIComponent(q)}&` : '') + 'pageSize=12')
      .then(setData)
      .catch(() => setData({ items: [] }));
  }, [q]);
  return (
    <main className="mx-auto max-w-6xl px-5 py-12">
      <div className="mb-10 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm text-emerald-600">{t('blogEyebrow')}</p>
          <h1 className="text-4xl font-black">{t('blogTitle')}</h1>
        </div>
        <input
          className="rounded-xl border px-4 py-3"
          placeholder={t('blogSearch')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      {!data ? (
        <p>{t('blogLoading')}</p>
      ) : !data.items?.length ? (
        <p>{t('blogEmpty')}</p>
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
  );
}
