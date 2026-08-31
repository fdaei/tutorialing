'use client';
import Link from 'next/link';
import { Clock3, Headphones, Mail, Menu, MessageCircle, Phone, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/services/api';
import { LanguageSwitcher } from '@/components/shared/language-switcher';
import { useTranslations } from '@/components/shared/locale-provider';
import { localePath, localized, translate } from '@/lib/i18n';
import { webConfig } from '@/config';
import { onAuthSessionChange } from '@/shared/services/api';

export function Brand() {
  return (
    <span className="flex items-center gap-2">
      <span className="brand-gradient grid size-10 place-items-center rounded-full text-lg font-black text-white shadow-lg">
        <MessageCircle size={23} />
      </span>
      <strong className="latin text-xl font-bold text-navy">LingoSpeak</strong>
    </span>
  );
}

export function Header() {
  const { locale, t } = useTranslations(),
    p = (x: string) => localePath(x, locale),
    [open, setOpen] = useState(false),
    queryClient = useQueryClient(),
    pathname = usePathname();
  const me = useQuery({ queryKey: ['header-me'], queryFn: () => api<{ roles: string[] }>('/users/me'), retry: false });
  useEffect(
    () =>
      onAuthSessionChange((state) => {
        if (state === 'anonymous') queryClient.setQueryData(['header-me'], null);
        else void queryClient.invalidateQueries({ queryKey: ['header-me'] });
      }),
    [queryClient],
  );
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open]);
  const links: [string, string][] = [
    [p('/'), translate(locale, 'layoutsiteHome')],
    [p('/courses'), translate(locale, 'layoutsiteCourses')],
    [p('/teachers'), t('teachers')],
    [p('/languages'), translate(locale, 'layoutsiteLanguages')],
    [p('/blog'), translate(locale, 'layoutsiteMagazine')],
    [p('/about'), translate(locale, 'layoutsiteAboutUs')],
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-transparent bg-white/92 backdrop-blur-xl">
      <div className="mx-auto flex h-[76px] max-w-[1380px] items-center justify-between px-5 lg:px-8">
        <Link href={p('/')}>
          <Brand />
        </Link>
        <nav aria-label={t('mainNavigation')} className="hidden items-center gap-9 text-sm font-bold lg:flex">
          {links.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              aria-current={isActiveNavigationPath(pathname, href) ? 'page' : undefined}
              className="hover:text-blue aria-[current=page]:text-purple"
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2.5">
          <LanguageSwitcher className="hidden sm:inline-flex" />
          <Link
            href={p(me.data ? '/panel' : '/auth')}
            className="rounded-xl border border-[#cfd5e5] bg-white px-5 py-2.5 text-sm font-bold hover:border-purple"
          >
            {me.data ? t('dashboard') : t('signIn')}
          </Link>
          <Link
            href={p('/teach')}
            className="brand-gradient brand-glow hidden rounded-xl px-5 py-2.5 text-sm font-bold text-white sm:block"
          >
            {translate(locale, 'layoutsiteTeachWithUs')}
          </Link>
          <button
            className="grid size-10 place-items-center lg:hidden"
            onClick={() => setOpen((x) => !x)}
            aria-label={t('openMenu')}
            aria-expanded={open}
            aria-controls="mobile-main-navigation"
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </div>
      {open && (
        <nav id="mobile-main-navigation" className="grid gap-2 border-t hairline bg-white p-5 lg:hidden">
          {links.map(([href, label]) => (
            <Link
              key={href}
              onClick={() => setOpen(false)}
              href={href}
              aria-current={isActiveNavigationPath(pathname, href) ? 'page' : undefined}
              className="rounded-xl px-4 py-3 font-bold hover:bg-lavender aria-[current=page]:bg-lavender aria-[current=page]:text-purple"
            >
              {label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}

export function isActiveNavigationPath(pathname: string, href: string) {
  const normalizedPath = pathname.replace(/^\/en(?=\/|$)/, '') || '/';
  const normalizedHref = href.replace(/^\/en(?=\/|$)/, '') || '/';
  return normalizedHref === '/' ? normalizedPath === '/' : normalizedPath === normalizedHref || normalizedPath.startsWith(`${normalizedHref}/`);
}

export function Footer() {
  const { locale, t } = useTranslations(),
    p = (x: string) => localePath(x, locale);
  return (
    <footer className="border-t hairline bg-white">
      <div className="mx-auto grid max-w-[1380px] gap-10 px-6 py-14 md:grid-cols-4">
        <div className="md:col-span-1">
          <Brand />
          <p className="mt-5 text-sm leading-7 text-muted">
            {translate(locale, 'layoutsiteSmartIELTSTeacherMatchingFromAssessmentToA')}
          </p>
        </div>
        <div>
          <p className="font-black">{translate(locale, 'layoutsiteExplore')}</p>
          <div className="mt-4 grid gap-3 text-sm text-muted">
            <Link href={p('/teachers')}>{t('teachers')}</Link>
            <Link href={p('/placement')}>{t('placement')}</Link>
            <Link href={p('/matching')}>{t('matching')}</Link>
            <Link href={p('/about')}>{translate(locale, 'layoutsiteAboutUs')}</Link>
          </div>
        </div>
        <div>
          <p className="font-black">{translate(locale, 'teacherteacherMoreSupport')}</p>
          <div className="mt-4 grid gap-3 text-sm text-muted">
            <Link href={p('/faq')}>{translate(locale, 'layoutsiteFaq')}</Link>
            <Link href={p('/contact')}>{translate(locale, 'layoutsiteContact')}</Link>
            <Link href={p('/terms')}>{translate(locale, 'layoutsiteTerms')}</Link>
            <Link href={p('/privacy')}>{translate(locale, 'layoutsitePrivacy')}</Link>
            <Link href={p('/cancellation-policy')}>{translate(locale, 'layoutsiteCancellationAndRefunds')}</Link>
          </div>
        </div>
        <div>
          <p className="font-black">{translate(locale, 'layoutsiteContact')}</p>
          <div className="mt-4 grid gap-3 text-sm text-muted">
            <a href="tel:+982191094200" className="flex items-center gap-3 rounded-xl py-1 hover:text-purple" dir="ltr">
              <Phone size={17} aria-hidden="true" /> <span className="latin whitespace-nowrap">021 9109 4200</span>
            </a>
            <a href="mailto:support@lingospeak.ir" className="flex items-center gap-3 rounded-xl py-1 hover:text-purple" dir="ltr">
              <Mail size={17} aria-hidden="true" /> <span className="latin break-all">support@lingospeak.ir</span>
            </a>
            <p className="flex items-start gap-3"><Clock3 className="mt-0.5 shrink-0" size={17} aria-hidden="true" />{translate(locale, 'layoutsiteSaturdayThursday9002000')}</p>
          </div>
          <TrustSeals />
        </div>
      </div>
      <div className="border-t hairline py-5 text-center text-xs text-muted">
        © ۱۴۰۵ LingoSpeak — {translate(locale, 'layoutsiteAllRightsReserved')}
      </div>
    </footer>
  );
}

/**
 * Slot for the Enamad (اعتماد) e-trust seal, a launch prerequisite for taking
 * payments in Iran.
 *
 * Enamad issues a per-domain HTML snippet containing an anchor and an image
 * served from their own host, which cannot be known at build time — so it is
 * injected from `NEXT_PUBLIC_ENAMAD_HTML` rather than hardcoded. Until that is
 * set the slot renders nothing, so the footer looks finished rather than showing
 * a broken seal. `NEXT_PUBLIC_*` values are inlined at build time, so this needs
 * a rebuild after the snippet is issued, not just a restart.
 */
function TrustSeals() {
  const snippet = webConfig.enamadHtml;
  if (!snippet) return null;
  // Supplied by us via env, not by a user, and required verbatim by Enamad.
  return (
    <div
      className="mt-5 flex flex-wrap items-center gap-3 [&_img]:h-auto [&_img]:max-w-[90px]"
      dangerouslySetInnerHTML={{ __html: snippet }}
    />
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-violet/20 bg-lavender/70 px-4 py-2 text-xs font-bold text-purple">
      <span className="size-2 rounded-full bg-purple ring-4 ring-violet/15" />
      {children}
    </div>
  );
}
export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-3xl border border-dashed hairline p-12 text-center">
      <Headphones className="mx-auto mb-4 text-muted" />
      <h3 className="font-bold">{title}</h3>
      <p className="mt-2 text-sm text-muted">{body}</p>
    </div>
  );
}
