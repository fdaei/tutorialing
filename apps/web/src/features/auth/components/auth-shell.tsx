'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Check, Sparkles } from 'lucide-react';
import { useTranslations } from '@/components/shared/locale-provider';
import { localePath, localized, translate } from '@/lib/i18n';

export function AuthShell({
  children,
  illustration,
  illustrationAlt,
  compact = false,
}: {
  children: React.ReactNode;
  illustration: string;
  illustrationAlt: string;
  compact?: boolean;
}) {
  const { locale } = useTranslations();
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f4f6fb] px-3 py-3 text-[#111a38] sm:px-6 sm:py-6 lg:grid lg:place-items-center">
      <div aria-hidden className="absolute -right-32 -top-32 size-[30rem] rounded-full bg-[#7857ee]/10 blur-3xl" />
      <div aria-hidden className="absolute -bottom-44 -left-28 size-[34rem] rounded-full bg-[#315efb]/10 blur-3xl" />
      <section
        className={`relative mx-auto grid w-full max-w-[1160px] overflow-hidden rounded-[28px] border border-white bg-white shadow-[0_30px_90px_rgba(25,35,82,.13)] lg:min-h-[720px] lg:grid-cols-[minmax(0,1.05fr)_minmax(440px,.95fr)] ${compact ? 'lg:min-h-[800px]' : ''}`}
      >
        <Link
          href={localePath('/', locale)}
          aria-label={translate(locale, 'authauthShellBackToHome')}
          className="absolute left-5 top-5 z-20 grid size-10 place-items-center rounded-full border border-[#e2e6f0] bg-white/90 text-[#182342] shadow-sm backdrop-blur transition hover:border-[#cbd3e7] hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#5b52e8]/15 sm:left-7 sm:top-7"
        >
          <ArrowLeft size={21} strokeWidth={2.2} />
        </Link>

        <aside className="relative order-first min-h-[152px] overflow-hidden bg-[linear-gradient(145deg,#171c4b_0%,#353196_52%,#6852da_100%)] px-6 py-5 text-white lg:order-last lg:flex lg:min-h-full lg:flex-col lg:justify-between lg:px-12 lg:py-11">
          <div aria-hidden className="absolute -left-20 -top-20 size-72 rounded-full border border-white/10" />
          <div aria-hidden className="absolute -left-6 -top-6 size-44 rounded-full border border-white/10" />
          <div className="relative z-10 flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-white text-lg font-black text-[#4338a8] shadow-lg">
              L
            </span>
            <div>
              <p className="font-black tracking-tight">{translate(locale, 'authauthShellLingospeak')}</p>
              <p className="text-[11px] text-white/60">{translate(locale, 'authauthShellYourPersonalLanguagePath')}</p>
            </div>
          </div>

          <div className="relative z-10 mt-7 hidden lg:block">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold text-white/80 backdrop-blur">
              <Sparkles size={14} /> {translate(locale, 'authauthShellLearningShapedAroundYourGoal')}
            </span>
            <h2 className="mt-6 max-w-md text-[2.55rem] font-black leading-[1.45] tracking-[-.045em]">
              {translate(locale, 'authauthShellFromYourFirstWordToYourGoalWe')}
            </h2>
            <ul className="mt-7 space-y-3 text-sm text-white/75">
              {localized(
                {
                  fa: ['مدرس‌های تأییدشده', 'برنامهٔ یادگیری شخصی', 'پیگیری پیشرفت در یک مسیر روشن'],
                  en: ['Verified teachers', 'A personal learning plan', 'Clear progress tracking'],
                },
                locale,
              ).map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <span className="grid size-6 place-items-center rounded-full bg-white/12 text-[#c9ffdc]">
                    <Check size={14} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="pointer-events-none absolute -bottom-12 left-4 h-[240px] w-[240px] opacity-90 lg:relative lg:bottom-auto lg:left-auto lg:mx-auto lg:h-[270px] lg:w-[300px]">
            <div className="absolute inset-x-8 bottom-5 h-12 rounded-full bg-[#17133f]/40 blur-2xl" />
            <Image
              src={illustration}
              alt={illustrationAlt}
              fill
              priority
              sizes="(max-width: 1024px) 240px, 300px"
              className="object-contain drop-shadow-[0_22px_34px_rgba(12,15,50,.28)]"
            />
          </div>

          <div
            aria-hidden
            className="absolute bottom-8 right-8 hidden -rotate-6 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur-md lg:block"
          >
            <span className="block text-[10px] text-white/55">TODAY'S WORD</span>
            <strong className="mt-1 block text-xl" dir="ltr">
              progress
            </strong>
            <span className="text-xs text-[#d9d3ff]">{translate(locale, 'authauthShellMovingForward')}</span>
          </div>
        </aside>

        <div className="relative flex items-center px-5 py-9 sm:px-10 lg:px-14 lg:py-12">
          <div className="mx-auto w-full max-w-[470px]">{children}</div>
        </div>
      </section>
    </main>
  );
}

export function AuthHeading({ title, description }: { title: string; description: string }) {
  return (
    <header className="mb-8 text-right">
      <span className="mb-3 block text-xs font-black tracking-[.08em] text-[#6257db]">حساب کاربری</span>
      <h1 className="text-[2rem] font-black tracking-[-.045em] text-[#101936] sm:text-[2.35rem]">{title}</h1>
      <p className="mt-2 text-sm leading-7 text-[#667089] sm:text-[.95rem]">{description}</p>
    </header>
  );
}

export function AuthDivider({ className = 'my-6' }: { className?: string }) {
  return (
    <div
      className={`flex items-center gap-4 text-xs font-medium text-[#9098aa] before:h-px before:flex-1 before:bg-[#e4e7ef] after:h-px after:flex-1 after:bg-[#e4e7ef] ${className}`}
    >
      یا
    </div>
  );
}

export function AuthError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700"
    >
      {children}
    </p>
  );
}

export function AuthNotice({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p
      role="status"
      className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-700"
    >
      {children}
    </p>
  );
}

export function AuthFooter({ question, href, action }: { question: string; href: string; action: string }) {
  return (
    <p className="mt-7 text-center text-sm text-[#727c92]">
      {question}{' '}
      <Link href={href} className="font-black text-[#554ad3] hover:underline">
        {action}
      </Link>
    </p>
  );
}

export function PrimaryButton({
  children,
  busy,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean }) {
  return (
    <button
      {...props}
      disabled={busy || props.disabled}
      aria-busy={busy}
      className="mt-7 flex min-h-14 w-full items-center justify-center gap-2 rounded-[14px] bg-[linear-gradient(110deg,#5145d6,#6758e8)] px-5 text-base font-black text-white shadow-[0_12px_26px_rgba(80,68,207,.24)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(80,68,207,.30)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#6257db]/20 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {busy && (
        <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
      )}
      {children}
    </button>
  );
}
