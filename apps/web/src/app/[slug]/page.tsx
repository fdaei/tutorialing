import { localized } from '@/lib/i18n';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Header, Footer } from '@/components/layout/site';
import { ApiError, publicApi } from '@/shared/services/api';
import { requestLocale } from '@/lib/server-locale';
import Link from 'next/link';
import {
  ArrowLeft,
  BookOpenCheck,
  ChevronLeft,
  CircleHelp,
  FileLock2,
  HeartHandshake,
  Mail,
  MapPin,
  Phone,
  Scale,
  ShieldCheck,
} from 'lucide-react';
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
  try {
    return await publicApi<Page | null>(`/support/pages/${slug}`, { cache: 'no-store' });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
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
    locale = await requestLocale();
  if (!p) notFound();
  const paragraphs = localized({ fa: p.contentFa, en: p.contentEn }, locale).paragraphs;
  const meta = pageMeta[slug] ?? pageMeta.about!;
  const Icon = meta.icon;
  return (
    <>
      <Header />
      <main className="min-h-[60vh] bg-canvas">
        <section className="content-hero">
          <div className="page-shell py-12 md:py-20">
            <nav className="flex items-center gap-2 text-xs text-white/55">
              <Link href="/">خانه</Link>
              <ChevronLeft size={14} />
              <span>{localized({ fa: p.titleFa, en: p.titleEn }, locale)}</span>
            </nav>
            <div className="mt-10 grid items-end gap-8 md:grid-cols-[1fr_260px]">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold text-white">
                  <Icon size={17} />
                  {meta.eyebrow}
                </span>
                <h1 className="mt-6 text-4xl font-black leading-[1.4] text-white md:text-6xl">
                  {localized({ fa: p.titleFa, en: p.titleEn }, locale)}
                </h1>
                <p className="mt-4 max-w-2xl leading-8 text-white/65">{meta.intro}</p>
              </div>
              <div className="hidden justify-self-end rounded-[2rem] border border-white/15 bg-white/10 p-8 text-white backdrop-blur md:block">
                <Icon size={72} strokeWidth={1.2} />
              </div>
            </div>
          </div>
        </section>
        <div className="page-shell grid gap-8 py-12 lg:grid-cols-[1fr_280px]">
          <article className="surface-card p-6 md:p-10">
            <div className="content-prose">
              {paragraphs?.map((x, i) => (
                <section key={i} className="relative">
                  <span className="absolute -right-1 top-2 size-2 rounded-full bg-purple/30" />
                  <p>{x}</p>
                </section>
              ))}
            </div>
          </article>
          <aside className="space-y-5">
            <div className="surface-card p-5 lg:sticky lg:top-24">
              <h2 className="font-black">دسترسی سریع</h2>
              <div className="mt-4 grid gap-2 text-sm">
                {([
                  ['/about', 'درباره ما'],
                  ['/faq', 'پرسش‌های متداول'],
                  ['/contact', 'تماس با ما'],
                  ['/terms', 'قوانین'],
                  ['/privacy', 'حریم خصوصی'],
                ] as const).map(([href, label]) => (
                  <Link
                    href={href}
                    key={href}
                    className={`flex items-center justify-between rounded-xl px-3 py-2.5 ${href === `/${slug}` ? 'bg-lavender font-bold text-purple' : 'hover:bg-canvas'}`}
                  >
                    {label}
                    <ArrowLeft size={15} />
                  </Link>
                ))}
              </div>
              {slug === 'contact' && (
                <div className="mt-5 border-t hairline pt-5 text-sm">
                  <a href="tel:+982191094200" dir="ltr" className="flex items-center gap-2 py-2">
                    <Phone size={16} />
                    021 9109 4200
                  </a>
                  <a href="mailto:support@lingospeak.ir" dir="ltr" className="flex items-center gap-2 break-all py-2">
                    <Mail size={16} />
                    support@lingospeak.ir
                  </a>
                  <p className="flex items-center gap-2 py-2 text-muted">
                    <MapPin size={16} />
                    تهران، ایران
                  </p>
                </div>
              )}
            </div>
          </aside>
        </div>
      </main>
      <Footer />
    </>
  );
}

const pageMeta: Record<string, { icon: typeof ShieldCheck; eyebrow: string; intro: string }> = {
  about: {
    icon: HeartHandshake,
    eyebrow: 'داستان لینگواسپیک',
    intro: 'ما زبان‌آموز، مدرس و مسیر یادگیری را در یک تجربه روشن و قابل اعتماد کنار هم قرار می‌دهیم.',
  },
  faq: {
    icon: CircleHelp,
    eyebrow: 'پاسخ‌های روشن',
    intro: 'پاسخ کوتاه و مستقیم به پرسش‌هایی که پیش از شروع یا در طول مسیر ممکن است داشته باشید.',
  },
  contact: {
    icon: Mail,
    eyebrow: 'کنار شما هستیم',
    intro: 'برای راهنمایی آموزشی، حساب کاربری یا پرداخت با تیم پشتیبانی در ارتباط باشید.',
  },
  terms: {
    icon: Scale,
    eyebrow: 'قواعد همکاری',
    intro: 'چارچوب استفاده منصفانه و شفاف از خدمات برای زبان‌آموزان و مدرس‌ها.',
  },
  privacy: {
    icon: FileLock2,
    eyebrow: 'حریم خصوصی',
    intro: 'توضیح روشن درباره داده‌هایی که نگهداری می‌کنیم و کنترل‌هایی که در اختیار شماست.',
  },
  'cancellation-policy': {
    icon: BookOpenCheck,
    eyebrow: 'لغو و بازپرداخت',
    intro: 'زمان‌بندی‌ها، مسئولیت‌ها و شرایط بازگشت وجه به زبان ساده.',
  },
  'how-it-works': {
    icon: BookOpenCheck,
    eyebrow: 'مسیر یادگیری',
    intro: 'از تعیین سطح تا انتخاب مدرس و دنبال کردن پیشرفت، قدم‌به‌قدم.',
  },
};
