import { localized, isDefaultLocale } from '@/lib/i18n';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Header, Footer } from '@/components/layout/site';
import { publicApi } from '@/lib/api';
import { requestLocale } from '@/lib/server-locale';
type Page = {
  slug: string;
  titleFa: string;
  titleEn: string;
  contentFa: { paragraphs?: string[] };
  contentEn: { paragraphs?: string[] };
  seo: { description?: string };
};
const allowed = [
  'about',
  'how-it-works',
  'faq',
  'contact',
  'terms',
  'privacy',
  'cancellation-policy',
  'become-a-teacher',
];
async function load(slug: string) {
  if (!allowed.includes(slug)) return null;
  return publicApi<Page | null>(`/support/pages/${slug}`, { cache: 'no-store' }).catch(() => null);
}
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params,
    p = await load(slug),
    locale = await requestLocale();
  return p ? { title: localized({ fa: p.titleFa, en: p.titleEn }, locale), description: p.seo?.description } : {};
}
export default async function CmsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params,
    p = await load(slug),
    locale = await requestLocale(),
    fa = isDefaultLocale(locale);
  if (!p) notFound();
  const paragraphs = localized({ fa: p.contentFa, en: p.contentEn }, locale).paragraphs;
  return (
    <>
      <Header />
      <main className="mx-auto min-h-[60vh] max-w-4xl px-6 py-20">
        <p className="text-sm font-bold text-purple">{localized({ fa: p.titleEn, en: p.titleFa }, locale)}</p>
        <h1 className="display mt-4 text-5xl">{localized({ fa: p.titleFa, en: p.titleEn }, locale)}</h1>
        <div className="surface-card mt-10 grid gap-6 p-8 text-lg leading-9 text-muted">
          {paragraphs?.map((x, i) => (
            <p key={i}>{x}</p>
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}
