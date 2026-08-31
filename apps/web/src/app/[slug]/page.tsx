import { localePath, localized } from '@/lib/i18n';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Header, Footer } from '@/components/layout/site';
import { ApiError, publicApi } from '@/shared/services/api';
import { requestLocale } from '@/lib/server-locale';
import { publicPageMetadata } from '@/lib/public-metadata';
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
    meta = pageMeta[slug];
  if (!p) return {};
  const description = meta?.intro ?? { fa: p.seo?.description ?? p.titleFa, en: p.titleEn };
  return publicPageMetadata(`/${slug}`, { fa: p.titleFa, en: p.titleEn }, description);
}
export default async function CmsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params,
    p = await load(slug),
    locale = await requestLocale();
  if (!p) notFound();
  const paragraphs = localized({ fa: p.contentFa, en: p.contentEn }, locale).paragraphs;
  const meta = pageMeta[slug] ?? pageMeta.about!;
  const english = locale === 'en';
  const t = (fa: string, en: string) => english ? en : fa;
  const Icon = meta.icon;
  return (
    <>
      <Header />
      <main className="min-h-[60vh] bg-canvas">
        <section className="content-hero">
          <div className="page-shell py-12 md:py-20">
            <nav className="flex items-center gap-2 text-xs text-white/55">
              <Link href={localePath('/', locale)}>{t('خانه', 'Home')}</Link>
              <ChevronLeft className={english ? 'rotate-180' : undefined} size={14} />
              <span>{localized({ fa: p.titleFa, en: p.titleEn }, locale)}</span>
            </nav>
            <div className="mt-10 grid items-end gap-8 md:grid-cols-[1fr_260px]">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold text-white">
                  <Icon size={17} />
                  {localized(meta.eyebrow, locale)}
                </span>
                <h1 className="mt-6 text-4xl font-black leading-[1.4] text-white md:text-6xl">
                  {localized({ fa: p.titleFa, en: p.titleEn }, locale)}
                </h1>
                <p className="mt-4 max-w-2xl leading-8 text-white/65">{localized(meta.intro, locale)}</p>
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
                  <span className="absolute end-[-0.25rem] top-2 size-2 rounded-full bg-purple/30" />
                  <p>{x}</p>
                </section>
              ))}
              {!paragraphs?.length && <p>{t('محتوای این صفحه هنوز منتشر نشده است.', 'This page does not have published content yet.')}</p>}
            </div>
          </article>
          <aside className="space-y-5">
            <div className="surface-card p-5 lg:sticky lg:top-24">
              <h2 className="font-black">{t('دسترسی سریع', 'Quick links')}</h2>
              <div className="mt-4 grid gap-2 text-sm">
                {([
                  ['/about', t('درباره ما', 'About us')],
                  ['/faq', t('پرسش‌های متداول', 'FAQ')],
                  ['/contact', t('تماس با ما', 'Contact us')],
                  ['/terms', t('قوانین', 'Terms')],
                  ['/privacy', t('حریم خصوصی', 'Privacy')],
                ] as const).map(([href, label]) => (
                  <Link
                    href={localePath(href, locale)}
                    key={href}
                    className={`flex items-center justify-between rounded-xl px-3 py-2.5 ${href === `/${slug}` ? 'bg-lavender font-bold text-purple' : 'hover:bg-canvas'}`}
                  >
                    {label}
                    <ArrowLeft className={english ? 'rotate-180' : undefined} size={15} />
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
                    {t('تهران، ایران', 'Tehran, Iran')}
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

type LocalizedCopy = { fa: string; en: string };
const pageMeta: Record<string, { icon: typeof ShieldCheck; eyebrow: LocalizedCopy; intro: LocalizedCopy }> = {
  about: {
    icon: HeartHandshake,
    eyebrow: { fa: 'داستان لینگواسپیک', en: 'The LingoSpeak story' },
    intro: { fa: 'ما زبان‌آموز، مدرس و مسیر یادگیری را در یک تجربه روشن و قابل اعتماد کنار هم قرار می‌دهیم.', en: 'We bring learners, teachers, and a clear learning route together in one trusted experience.' },
  },
  faq: {
    icon: CircleHelp,
    eyebrow: { fa: 'پاسخ‌های روشن', en: 'Clear answers' },
    intro: { fa: 'پاسخ کوتاه و مستقیم به پرسش‌هایی که پیش از شروع یا در طول مسیر ممکن است داشته باشید.', en: 'Direct answers to questions you may have before you begin or while you learn.' },
  },
  contact: {
    icon: Mail,
    eyebrow: { fa: 'کنار شما هستیم', en: 'Here when you need us' },
    intro: { fa: 'برای راهنمایی آموزشی، حساب کاربری یا پرداخت با تیم پشتیبانی در ارتباط باشید.', en: 'Contact support for help with learning, your account, bookings, or payments.' },
  },
  terms: {
    icon: Scale,
    eyebrow: { fa: 'قواعد همکاری', en: 'Working together' },
    intro: { fa: 'چارچوب استفاده منصفانه و شفاف از خدمات برای زبان‌آموزان و مدرس‌ها.', en: 'The transparent, fair-use framework for learners and teachers using LingoSpeak.' },
  },
  privacy: {
    icon: FileLock2,
    eyebrow: { fa: 'حریم خصوصی', en: 'Your privacy' },
    intro: { fa: 'توضیح روشن درباره داده‌هایی که نگهداری می‌کنیم و کنترل‌هایی که در اختیار شماست.', en: 'A clear account of the data we keep and the controls available to you.' },
  },
  'cancellation-policy': {
    icon: BookOpenCheck,
    eyebrow: { fa: 'لغو و بازپرداخت', en: 'Cancellations and refunds' },
    intro: { fa: 'زمان‌بندی‌ها، مسئولیت‌ها و شرایط بازگشت وجه به زبان ساده.', en: 'Timelines, responsibilities, and refund terms in plain language.' },
  },
  'how-it-works': {
    icon: BookOpenCheck,
    eyebrow: { fa: 'مسیر یادگیری', en: 'Your learning route' },
    intro: { fa: 'از تعیین سطح تا انتخاب مدرس و دنبال کردن پیشرفت، قدم‌به‌قدم.', en: 'From placement to choosing a teacher and tracking progress, one step at a time.' },
  },
  'become-a-teacher': {
    icon: HeartHandshake,
    eyebrow: { fa: 'تدریس در لینگواسپیک', en: 'Teach with LingoSpeak' },
    intro: { fa: 'مراحل بررسی، ساخت پروفایل و شروع تدریس را شفاف و قدم‌به‌قدم ببینید.', en: 'See how review, profile setup, and teaching work, step by step.' },
  },
};
