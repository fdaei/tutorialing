'use client';
import Link from 'next/link';
import { BadgeCheck, Clock3, Headphones, Mail, Menu, Phone, ShieldCheck, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/services/api';
import { LanguageToggle } from '@/components/shared/language-switcher';
import { useTranslations } from '@/components/shared/locale-provider';
import { localePath, localized, translate } from '@/lib/i18n';
import { contactPhoneHref, isLinkEnabled, webConfig } from '@/config';
import { onAuthSessionChange } from '@/shared/services/api';
import { usePublicNavigation } from '@/features/navigation/navigation-config';
import { defaultLandingConfig, type LandingConfig } from '@/features/landing';

/** The LingoSpeak logo. The artwork carries the wordmark, so the name is the image's accessible text. */
export function BrandLogo({ name = 'LingoSpeak', src }: { name?: string; src?: string }) {
  if (src) {
    return <img src={src} alt={name} width={160} height={44} className="landing-brand-logo" />;
  }

  return (
    <span className="landing-brand-wordmark" aria-label={name}>
      <span className="landing-brand-mark" aria-hidden="true">
        L
      </span>
      <span>{name}</span>
    </span>
  );
}

type HeaderProps = {
  /**
   * The landing page passes its server-rendered builder config so the menu is
   * in the first paint; every other page reads the same published menu client-side.
   */
  config?: Pick<LandingConfig, 'brand' | 'header'>;
};

export function Header({ config }: HeaderProps = {}) {
  const { locale, t } = useTranslations(),
    p = (x: string) => localePath(x, locale),
    [open, setOpen] = useState(false),
    queryClient = useQueryClient(),
    pathname = usePathname();
  const navigation = usePublicNavigation();
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
  const { brand, header } = config ?? defaultLandingConfig;
  const items = navigation.isSuccess || !config ? navigation.items : config.header.nav;
  const loading = navigation.isLoading && !config;
  const links = items
    .filter((item) => item.visible && isLinkEnabled(item.href))
    .map((item) => ({
      id: item.id,
      href: p(item.href),
      label: localized({ fa: item.label.fa, en: item.label.en }, locale),
    }));
  const signedIn = Boolean(me.data);
  return (
    <header
      className={header.sticky ? 'landing-header landing-header-sticky' : 'landing-header'}
      style={{ backgroundColor: header.background }}
    >
      <div className="landing-container landing-header-inner">
        <Link href={p('/')} className="landing-brand">
          <BrandLogo name={brand.name} src={brand.logo} />
        </Link>
        <nav aria-label={t('mainNavigation')} aria-busy={loading} className="landing-desktop-nav">
          {loading
            ? [1, 2, 3, 4].map((item) => <span key={item} className="h-4 w-14 animate-pulse rounded-full bg-canvas" />)
            : links.map(({ id, href, label }) => (
                <Link key={id} href={href} aria-current={isActiveNavigationPath(pathname, href) ? 'page' : undefined}>
                  {label}
                </Link>
              ))}
        </nav>
        <div className="landing-header-actions">
          <LanguageToggle className="landing-header-language" />
          {signedIn ? (
            <Link href={p('/panel')} className="landing-header-signup">
              {t('dashboard')}
            </Link>
          ) : (
            <>
              <Link href={p('/auth')} className="landing-header-signin">
                {localized(header.signIn, locale)}
              </Link>
              <Link href={p('/auth')} className="landing-header-signup">
                {localized(header.signUp, locale)}
              </Link>
            </>
          )}
          <button
            type="button"
            className="landing-menu-toggle"
            onClick={() => setOpen((x) => !x)}
            aria-label={t('openMenu')}
            aria-expanded={open}
            aria-controls="mobile-main-navigation"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
      {open && (
        <nav id="mobile-main-navigation" aria-label={t('mainNavigation')} className="landing-mobile-nav">
          <div className="landing-container">
            {links.map(({ id, href, label }) => (
              <Link
                key={id}
                href={href}
                onClick={() => setOpen(false)}
                aria-current={isActiveNavigationPath(pathname, href) ? 'page' : undefined}
              >
                {label}
              </Link>
            ))}
            {!signedIn && (
              <Link href={p('/auth')} onClick={() => setOpen(false)}>
                {localized(header.signIn, locale)}
              </Link>
            )}
            <Link href={p('/teach')} onClick={() => setOpen(false)}>
              {translate(locale, 'layoutsiteTeachWithUs')}
            </Link>
            <LanguageToggle className="landing-header-language" />
          </div>
        </nav>
      )}
    </header>
  );
}

export function isActiveNavigationPath(pathname: string, href: string) {
  const normalizedPath = pathname.replace(/^\/en(?=\/|$)/, '') || '/';
  const normalizedHref = href.replace(/^\/en(?=\/|$)/, '') || '/';
  return normalizedHref === '/'
    ? normalizedPath === '/'
    : normalizedPath === normalizedHref || normalizedPath.startsWith(`${normalizedHref}/`);
}

export function Footer() {
  const { locale, t } = useTranslations(),
    p = (x: string) => localePath(x, locale);
  const navigation = usePublicNavigation();
  return (
    <footer className="public-footer">
      <div className="public-footer-accent" />
      <div className="mx-auto grid max-w-[1240px] gap-10 px-6 py-16 md:grid-cols-4">
        <div className="md:col-span-1">
          <BrandLogo />
          <p className="mt-5 text-sm leading-7 text-muted">
            {translate(locale, 'layoutsiteSmartIELTSTeacherMatchingFromAssessmentToA')}
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-[11px] font-bold text-muted">
            <span className="public-trust-chip">
              <ShieldCheck size={14} />
              {locale === 'en' ? 'Secure experience' : 'تجربه امن'}
            </span>
            <span className="public-trust-chip">
              <BadgeCheck size={14} />
              {locale === 'en' ? 'Verified teachers' : 'مدرس تأییدشده'}
            </span>
          </div>
        </div>
        <div>
          <p className="font-black">{translate(locale, 'layoutsiteExplore')}</p>
          <div className="mt-4 grid gap-3 text-sm text-muted">
            {navigation.items
              .filter((item) => item.visible && isLinkEnabled(item.href))
              .map((item) => (
                <Link href={p(item.href)} key={item.id}>
                  {localized({ fa: item.label.fa, en: item.label.en }, locale)}
                </Link>
              ))}
            <Link href={p('/teach')}>{translate(locale, 'layoutsiteTeachWithUs')}</Link>
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
            <a href={contactPhoneHref} className="flex items-center gap-3 rounded-xl py-1 hover:text-purple" dir="ltr">
              <Phone size={17} aria-hidden="true" />{' '}
              <span className="latin whitespace-nowrap">{webConfig.contactPhone}</span>
            </a>
            <a
              href={`mailto:${webConfig.contactEmail}`}
              className="flex items-center gap-3 rounded-xl py-1 hover:text-purple"
              dir="ltr"
            >
              <Mail size={17} aria-hidden="true" /> <span className="latin break-all">{webConfig.contactEmail}</span>
            </a>
            <p className="flex items-start gap-3">
              <Clock3 className="mt-0.5 shrink-0" size={17} aria-hidden="true" />
              {translate(locale, 'layoutsiteSaturdayThursday9002000')}
            </p>
          </div>
          <TrustSeals />
        </div>
      </div>
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-3 border-t hairline px-6 py-5 text-xs text-muted">
        <span>© ۱۴۰۵ LingoSpeak — {translate(locale, 'layoutsiteAllRightsReserved')}</span>
        <span>
          {locale === 'en' ? 'Learn with clarity. Speak with confidence.' : 'شفاف یاد بگیر، با اعتمادبه‌نفس حرف بزن.'}
        </span>
      </div>
    </footer>
  );
}

export function PublicPageHero({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="public-page-hero">
      <div className="public-page-hero-copy">
        <span className="public-page-eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children && <div className="public-page-hero-aside">{children}</div>}
    </header>
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
