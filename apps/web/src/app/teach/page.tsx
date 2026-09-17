import Image from 'next/image';
import Link from 'next/link';
import { CalendarDays, LineChart, Users, WalletCards } from 'lucide-react';
import { Footer, Header } from '@/components/layout/site';
import { localePath, localized } from '@/lib/i18n';
import { requestLocale } from '@/lib/server-locale';
import { resolveHeaderConfig } from '@/lib/header-config';

const items = [
  [Users, { fa: 'زبان‌آموزان تازه', en: 'New learners' }],
  [CalendarDays, { fa: 'زمان‌بندی در اختیار شما', en: 'Your own schedule' }],
  [WalletCards, { fa: 'درآمد شفاف', en: 'Transparent earnings' }],
  [LineChart, { fa: 'ابزار رشد حرفه‌ای', en: 'Professional growth tools' }],
] as const;

export default async function TeachPage() {
  const [locale, headerConfig] = await Promise.all([requestLocale(), resolveHeaderConfig()]);
  const t = (copy: { fa: string; en: string }) => localized(copy, locale);

  return (
    <>
      <Header config={headerConfig} />
      <main>
        <section className="hero-wash">
          <div className="page-shell grid items-center gap-10 py-16 lg:grid-cols-2">
            <div>
              <p className="font-black text-purple">{t({ fa: 'تدریس در LingoSpeak', en: 'Teach with LingoSpeak' })}</p>
              <h1 className="mt-4 text-5xl font-black leading-[1.35]">
                {t({
                  fa: 'دانشتان را به یک مسیر حرفه‌ای تبدیل کنید',
                  en: 'Turn your expertise into a professional path',
                })}
              </h1>
              <p className="mt-5 leading-8 text-muted">
                {t({
                  fa: 'پروفایل حرفه‌ای بسازید، برنامه کلاس‌ها را خودتان تعیین کنید و با زبان‌آموزان مناسب ارتباط بگیرید.',
                  en: 'Build a professional profile, set your own lesson schedule, and connect with the right learners.',
                })}
              </p>
              <Link
                href={localePath('/teach/register', locale)}
                className="brand-gradient mt-8 inline-flex rounded-xl px-8 py-4 font-black text-white"
              >
                {t({ fa: 'شروع ثبت‌نام مدرس', en: 'Start teacher registration' })}
              </Link>
            </div>
            <div className="relative min-h-[420px]">
              <Image
                src="/images/auth/register.png"
                alt={t({ fa: 'مدرس زبان در محیط آموزشی', en: 'Language teacher in an education workspace' })}
                fill
                className="object-contain"
              />
            </div>
          </div>
        </section>
        <section className="page-shell section-space grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {items.map(([Icon, title]) => (
            <article className="market-card p-7" key={title.en}>
              <Icon className="text-purple" />
              <h2 className="mt-5 font-black">{t(title)}</h2>
              <p className="mt-3 text-sm leading-7 text-muted">
                {t({
                  fa: 'همه‌چیز برای مدیریت ساده‌تر کلاس‌ها و تمرکز بیشتر روی آموزش.',
                  en: 'Everything you need to manage lessons more easily and focus on teaching.',
                })}
              </p>
            </article>
          ))}
        </section>
      </main>
      <Footer />
    </>
  );
}
