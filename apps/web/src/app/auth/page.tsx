'use client';

import Image from 'next/image';
import Link from 'next/link';
import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, ChevronDown, ShieldCheck, Sparkles, Smartphone } from 'lucide-react';
import { api, publicApi, ApiError, apiField } from '@/shared/services/api';
import { useTranslations } from '@/components/shared/locale-provider';
import { localePath, localized, isDefaultLocale, translate } from '@/lib/i18n';
import { LanguageSwitcher } from '@/components/shared/language-switcher';
import { canOpenRequestedPanel, panelHome, safeInternalPath, type PanelIdentity } from '@/lib/panel-access';
import { webConfig } from '@/config';
import { storeAccessToken } from '@/shared/services/api';
import { routeTo, routes } from '@/app/router/routes';

type AuthCountry = {
  id: string;
  code: string;
  flag: string;
  dialCode: string;
  nameFa: string;
  nameEn: string;
  minLength: number;
  maxLength: number;
};

function ResendCountdown({ wait, total, fa }: { wait: number; total: number; fa: boolean }) {
  if (wait <= 0) return null;
  return (
    <div className="mt-4 rounded-[14px] border border-[#e4e1f7] bg-[#faf9ff] px-4 py-3" aria-live="polite">
      <div className="flex items-center justify-between gap-4 text-xs text-[#727c92]">
        <span>{translate(fa, 'authTimeUntilYouCanResend')}</span>
        <strong dir="ltr" className="shrink-0 font-black tabular-nums text-[#554ad3]">
          {`${String(Math.floor(wait / 60)).padStart(2, '0')}:${String(wait % 60).padStart(2, '0')}`}
        </strong>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#e5e1fa]" dir="ltr">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#5145d6,#7868ef)] transition-[width] duration-1000 ease-linear"
          style={{ width: `${Math.min(100, (wait / Math.max(1, total)) * 100)}%` }}
        />
      </div>
    </div>
  );
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(options: { client_id: string; callback: (response: { credential: string }) => void }): void;
          renderButton(element: HTMLElement, options: Record<string, string | number>): void;
        };
      };
    };
  }
}

export default function Auth() {
  const router = useRouter(),
    params = useSearchParams(),
    { locale } = useTranslations(),
    fa = isDefaultLocale(locale),
    p = (href: string) => localePath(href, locale),
    Arrow = localized({ fa: ArrowLeft, en: ArrowRight }, locale);
  const [step, setStep] = useState<'phone' | 'otp'>('phone'),
    [phone, setPhone] = useState(''),
    [countries, setCountries] = useState<AuthCountry[]>([]),
    [countriesLoading, setCountriesLoading] = useState(true),
    [countryCode, setCountryCode] = useState(''),
    [digits, setDigits] = useState(['', '', '', '', '', '']),
    [challenge, setChallenge] = useState(''),
    [wait, setWait] = useState(0),
    [resendWindow, setResendWindow] = useState(60),
    [error, setError] = useState<unknown>(),
    [busy, setBusy] = useState(false),
    [googleAvailable, setGoogleAvailable] = useState(Boolean(webConfig.googleClientId)),
    [devCode, setDevCode] = useState<string>();
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]),
    googleButton = useRef<HTMLDivElement | null>(null),
    code = digits.join('');
  const country = countries.find((item) => item.code === countryCode) ?? countries[0];
  const internationalPhone = country ? `${country.dialCode}${phone.replace(/^0+/, '')}` : '';
  useEffect(() => {
    let cancelled = false;
    publicApi<AuthCountry[]>('/countries')
      .then((items) => {
        if (cancelled) return;
        setCountries(items);
        setCountryCode(items.find((item) => item.code === 'IR')?.code ?? items[0]?.code ?? '');
      })
      .catch((caught) => {
        if (!cancelled) setError(caught);
      })
      .finally(() => {
        if (!cancelled) setCountriesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    api<PanelIdentity>('/users/me')
      .then((user) => {
        if (cancelled) return;
        go(user);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    if (!wait) return;
    const timer = setInterval(
      () =>
        setWait((value) => {
          const next = Math.max(0, value - 1);
          if (next === 0) {
            setError((current: unknown) =>
              current instanceof ApiError &&
              ['OTP_RESEND_TOO_SOON', 'RATE_LIMITED'].includes(current.details.code ?? '')
                ? undefined
                : current,
            );
          }
          return next;
        }),
      1000,
    );
    return () => clearInterval(timer);
  }, [wait]);
  // `?next=` is attacker-controllable, so it is normalized to a same-origin path
  // and checked against the panel allow-list before it is ever navigated to;
  // anything rejected falls back to the user's own panel home. localePath()
  // already strips and re-adds the /en prefix, so it is safe to apply to either.
  function go(user: PanelIdentity) {
    const requested = safeInternalPath(params.get('next'));
    const target = requested && canOpenRequestedPanel(requested, user) ? requested : panelHome(user);
    router.replace(p(target));
  }
  async function send() {
    setError(undefined);
    if (!country) {
      setError(new Error(translate(locale, 'authTheCountryListIsNotAvailableYet')));
      return;
    }
    const localLength = phone.replace(/^0+/, '').length;
    if (localLength < country.minLength || localLength > country.maxLength) {
      setError(
        new ApiError(400, {
          code: 'PHONE_INVALID',
          message: translate(locale, 'authTheMobileNumberIsInvalid'),
          fieldErrors: {
            phone: localized(
              {
                fa: `شماره را بدون پیش‌شماره کشور وارد کنید؛ برای ${country.nameFa} باید ${country.minLength}${country.minLength === country.maxLength ? '' : ` تا ${country.maxLength}`} رقم باشد.`,
                en: `Enter the number without its country code; ${country.nameEn} numbers must contain ${country.minLength}${country.minLength === country.maxLength ? '' : `–${country.maxLength}`} digits.`,
              },
              locale,
            ),
          },
        }),
      );
      return;
    }
    setBusy(true);
    try {
      const response = await publicApi<{ challengeId: string; resendIn: number; developmentCode?: string }>(
        '/auth/otp/request',
        { method: 'POST', body: JSON.stringify({ phone: internationalPhone }) },
      );
      setChallenge(response.challengeId);
      setWait(response.resendIn);
      setResendWindow(Math.max(1, response.resendIn));
      setDevCode(response.developmentCode);
      setDigits(['', '', '', '', '', '']);
      setStep('otp');
      setTimeout(() => otpRefs.current[0]?.focus(), 20);
    } catch (caught) {
      if (caught instanceof ApiError && ['OTP_RESEND_TOO_SOON', 'RATE_LIMITED'].includes(caught.details.code ?? '')) {
        const retryAfter = caught.details.retryAfterSeconds ?? wait;
        setWait(retryAfter);
        setResendWindow((current) => Math.max(current, retryAfter, 1));
      }
      setError(caught);
    } finally {
      setBusy(false);
    }
  }
  async function verify() {
    setError(undefined);
    if (code.length !== 6) {
      setError(
        new ApiError(400, {
          code: 'OTP_INVALID',
          message: translate(locale, 'authTheVerificationCodeIsIncomplete'),
          fieldErrors: {
            code: translate(locale, 'authEnterAllSixDigitsFromTheSMS'),
          },
        }),
      );
      return;
    }
    setBusy(true);
    try {
      const response = await publicApi<{ accessToken: string; user?: PanelIdentity }>('/auth/otp/verify', {
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ phone: internationalPhone, challengeId: challenge, code }),
      });
      storeAccessToken(response.accessToken);
      go(response.user ?? {});
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  }
  async function googleSignIn(credential: string) {
    setBusy(true);
    setError(undefined);
    try {
      const response = await publicApi<{ accessToken: string; user?: PanelIdentity }>('/auth/google', {
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ credential }),
      });
      storeAccessToken(response.accessToken);
      go(response.user ?? {});
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  }
  function initializeGoogle() {
    if (!webConfig.googleClientId || !window.google || !googleButton.current) {
      setGoogleAvailable(false);
      return;
    }
    window.google.accounts.id.initialize({
      client_id: webConfig.googleClientId,
      callback: ({ credential }) => googleSignIn(credential),
    });
    googleButton.current.replaceChildren();
    window.google.accounts.id.renderButton(googleButton.current, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      shape: 'rectangular',
      text: 'continue_with',
      width: 400,
      locale: translate(locale, 'panelpanelActionsEn'),
    });
  }
  function changeDigit(index: number, raw: string) {
    const value = raw.replace(/\D/g, '').slice(-1);
    setDigits((current) => current.map((digit, i) => (i === index ? value : digit)));
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  }
  function key(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace' && !digits[index] && index > 0) otpRefs.current[index - 1]?.focus();
    if (event.key === 'ArrowLeft' && index > 0) otpRefs.current[index - 1]?.focus();
    if (event.key === 'ArrowRight' && index < 5) otpRefs.current[index + 1]?.focus();
  }
  function paste(event: React.ClipboardEvent) {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    event.preventDefault();
    setDigits(Array.from({ length: 6 }, (_, i) => pasted[i] ?? ''));
    otpRefs.current[Math.min(5, pasted.length)]?.focus();
  }
  const c = localized(
    {
      fa: {
        badge: 'ورود یا ثبت‌نام',
        title: 'ورود به لینگواسپیک',
        verify: 'تأیید شماره',
        lead: 'شماره موبایل را وارد کنید تا کد ورود برای شما ارسال شود.',
        codeLead: `کد شش‌رقمی ارسال‌شده به ${internationalPhone} را وارد کنید.`,
        phone: 'شماره موبایل',
        continue: 'ارسال کد',
        verifyButton: 'تأیید و ورود',
        busy: 'در حال پردازش…',
        edit: 'ویرایش شماره',
        resend: 'ارسال مجدد',
        resendWait: 'برای دریافت کد جدید کمی صبر کنید.',
        secondsRemaining: 'ثانیه باقی مانده',
        secure: 'ورود امن و بدون رمز عبور',
        passwordLogin: 'ورود با رمز عبور',
        forgotPassword: 'رمز عبور را فراموش کرده‌اید؟',
        noAccount: 'حساب کاربری ندارید؟',
        register: 'ثبت‌نام کنید',
        otherWays: 'روش‌های دیگر ورود',
        terms: 'با ادامه، شرایط استفاده و سیاست حفظ حریم خصوصی را می‌پذیرید.',
        verified: 'مدرس‌های تأییدشده',
        assessment: 'تعیین سطح مخصوص هر زبان',
        plan: 'رزرو مطابق زمان شما',
      },
      en: {
        badge: 'Sign in or create an account',
        title: 'Sign in to LingoSpeak',
        verify: 'Verify your number',
        lead: 'Enter your mobile number and we will send a sign-in code.',
        codeLead: `Enter the six-digit code sent to ${internationalPhone}.`,
        phone: 'Mobile number',
        continue: 'Send code',
        verifyButton: 'Verify and sign in',
        busy: 'Processing…',
        edit: 'Edit number',
        resend: 'Resend',
        resendWait: 'Please wait before requesting a new code.',
        secondsRemaining: 'seconds remaining',
        secure: 'Secure passwordless sign-in',
        passwordLogin: 'Sign in with password',
        forgotPassword: 'Forgot your password?',
        noAccount: "Don't have an account?",
        register: 'Create one',
        otherWays: 'Other sign-in options',
        terms: 'By continuing, you accept the Terms of Use and Privacy Policy.',
        verified: 'Verified teachers',
        assessment: 'Language-specific assessment',
        plan: 'Book around your schedule',
      },
    },
    locale,
  );
  const resendBlocked =
      error instanceof ApiError && ['OTP_RESEND_TOO_SOON', 'RATE_LIMITED'].includes(error.details.code ?? ''),
    message = resendBlocked
      ? undefined
      : error instanceof ApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : undefined,
    field = apiField(error, step === 'phone' ? 'phone' : 'code');
  return (
    <main
      className="relative min-h-screen overflow-hidden bg-[#f4f6fb] px-3 py-3 text-[#111a38] sm:px-6 sm:py-6 lg:grid lg:place-items-center"
      dir={translate(locale, 'supportmyTicketManagerLtr')}
    >
      {webConfig.googleClientId && (
        <Script
          src="https://accounts.google.com/gsi/client"
          strategy="afterInteractive"
          onLoad={initializeGoogle}
          onError={() => setGoogleAvailable(false)}
        />
      )}
      <LanguageSwitcher
        className={`absolute top-5 z-30 rounded-xl border border-[#e2e6f0] bg-white/90 px-3 py-2 shadow-sm backdrop-blur ${translate(locale, 'authRight16SmRight20')}`}
      />
      <div aria-hidden className="absolute -right-32 -top-32 size-[30rem] rounded-full bg-[#7857ee]/10 blur-3xl" />
      <div aria-hidden className="absolute -bottom-44 -left-28 size-[34rem] rounded-full bg-[#315efb]/10 blur-3xl" />
      <div className="relative mx-auto grid w-full max-w-[1160px] overflow-hidden rounded-[28px] border border-white bg-white shadow-[0_30px_90px_rgba(25,35,82,.13)] lg:min-h-[720px] lg:grid-cols-[minmax(0,1.05fr)_minmax(440px,.95fr)]">
        <Link
          href={p('/')}
          aria-label={translate(locale, 'authauthShellBackToHome')}
          className={`absolute top-5 z-20 grid size-10 place-items-center rounded-full border border-[#e2e6f0] bg-white/90 text-[#182342] shadow-sm backdrop-blur transition hover:bg-white focus-visible:ring-4 focus-visible:ring-[#5b52e8]/15 sm:top-7 ${translate(locale, 'authRight5SmRight7')}`}
        >
          <Arrow size={21} strokeWidth={2.2} />
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
              {[c.verified, c.assessment, c.plan].map((item) => (
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
              src={step === 'phone' ? '/images/auth/login.png' : '/images/auth/verify.png'}
              alt={localized(
                {
                  fa: step === 'phone' ? 'تصویر سپر و قفل امنیتی' : 'تصویر تلفن همراه و سپر تأیید',
                  en: step === 'phone' ? 'Security shield and lock' : 'Phone and verification shield',
                },
                locale,
              )}
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
            <span className="block text-[10px] text-white/55">TODAY&apos;S WORD</span>
            <strong className="mt-1 block text-xl" dir="ltr">
              progress
            </strong>
            <span className="text-xs text-[#d9d3ff]">{translate(locale, 'authauthShellMovingForward')}</span>
          </div>
        </aside>

        <section className="relative flex items-center px-5 py-9 sm:px-10 lg:px-14 lg:py-12">
          <div className="mx-auto w-full max-w-[470px]" dir={translate(locale, 'supportmyTicketManagerLtr')}>
            <header className="mb-8">
              <span className="mb-3 block text-xs font-black tracking-[.08em] text-[#6257db]">
                {step === 'phone' ? c.badge : c.verify}
              </span>
              <h1 className="text-[2rem] font-black tracking-[-.045em] text-[#101936] sm:text-[2.35rem]">
                {step === 'phone' ? c.title : c.verify}
              </h1>
              <p className="mt-2 text-sm leading-7 text-[#667089] sm:text-[.95rem]">
                {step === 'phone' ? c.lead : c.codeLead}
              </p>
            </header>
            {message && (
              <div role="alert" className="mt-6 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-800">
                <strong className="block">{message}</strong>
                {field && <span className="mt-1 block">{field}</span>}
              </div>
            )}
            {step === 'phone' ? (
              <div className="block">
                <label htmlFor="auth-phone" className="mb-2 block text-sm font-bold text-[#28324d]">
                  {c.phone}
                </label>
                <div
                  dir="ltr"
                  className={`grid min-h-[60px] grid-cols-[minmax(145px,42%)_1px_minmax(0,1fr)] items-center overflow-hidden rounded-[16px] border bg-[#fbfcfe] shadow-[0_5px_16px_rgba(24,35,66,.035)] transition hover:border-[#cfd5e3] hover:bg-white focus-within:border-[#6257db] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#6257db]/10 ${field ? 'border-red-400' : 'border-[#dce1eb]'}`}
                >
                  <div className="relative flex h-full min-w-0 items-center">
                    <select
                      aria-label={translate(locale, 'authCountryAndCallingCode')}
                      lang={translate(locale, 'panelpanelActionsEn')}
                      value={countryCode}
                      disabled={!countries.length}
                      onChange={(event) => {
                        setCountryCode(event.target.value);
                        setPhone('');
                      }}
                      className="h-full w-full appearance-none truncate bg-transparent py-3 pl-8 pr-3 text-sm font-black text-[#28324d] outline-none disabled:opacity-60"
                    >
                      {!countries.length && (
                        <option value="">
                          {countriesLoading ? translate(locale, 'authLoading') : translate(locale, 'authNoCountries')}
                        </option>
                      )}
                      {countries.map((item) => (
                        <option key={item.code} value={item.code}>
                          {item.flag} {item.dialCode} · {localized({ fa: item.nameFa, en: item.nameEn }, locale)}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      aria-hidden
                      size={16}
                      className="pointer-events-none absolute left-2.5 text-[#8b94aa]"
                    />
                  </div>
                  <span aria-hidden className="h-8 w-px bg-[#e2e6ef]" />
                  <div className="flex min-w-0 items-center px-3">
                    <Smartphone aria-hidden size={19} className="shrink-0 text-[#8b94aa]" />
                    <input
                      id="auth-phone"
                      inputMode="tel"
                      autoComplete="tel"
                      aria-invalid={field ? true : undefined}
                      aria-describedby={field ? 'auth-phone-error' : undefined}
                      value={phone}
                      onChange={(event) => {
                        let digits = event.target.value.replace(/\D/g, '');
                        const dial = country?.dialCode.slice(1) ?? '';
                        if (digits.startsWith(dial)) digits = digits.slice(dial.length);
                        setPhone(digits.replace(/^0+/, '').slice(0, country?.maxLength ?? 15));
                      }}
                      onKeyDown={(event) => event.key === 'Enter' && send()}
                      className="min-w-0 flex-1 bg-transparent px-3 py-4 text-base font-semibold tracking-wide outline-none placeholder:font-normal placeholder:tracking-normal placeholder:text-[#a0a9bb]"
                      disabled={!country}
                      placeholder={
                        countriesLoading
                          ? translate(locale, 'authPleaseWait')
                          : country?.code === 'IR'
                            ? '9390315707'
                            : translate(locale, 'authMobileNumber')
                      }
                    />
                  </div>
                </div>
                {field && (
                  <span id="auth-phone-error" role="alert" className="mt-2 block text-xs text-red-700">
                    {field}
                  </span>
                )}
                <ResendCountdown wait={wait} total={resendWindow} fa={fa} />
              </div>
            ) : (
              <div className="mt-8">
                <div dir="ltr" className="grid grid-cols-6 gap-2" onPaste={paste}>
                  {digits.map((digit, index) => (
                    <input
                      key={index}
                      ref={(node) => {
                        otpRefs.current[index] = node;
                      }}
                      aria-label={`${translate(locale, 'authDigit')} ${index + 1}`}
                      inputMode="numeric"
                      autoComplete={index === 0 ? 'one-time-code' : 'off'}
                      value={digit}
                      onChange={(event) => changeDigit(index, event.target.value)}
                      onKeyDown={(event) => key(index, event)}
                      className={`aspect-square min-w-0 rounded-[14px] border bg-[#fbfcfe] text-center text-2xl font-black outline-none transition focus:bg-white focus:ring-4 focus:ring-[#6257db]/10 ${field ? 'border-red-400' : 'border-[#dce1eb] focus:border-[#6257db]'}`}
                    />
                  ))}
                </div>
                {field && <span className="mt-2 block text-xs text-red-700">{field}</span>}
                {devCode && (
                  <span className="mt-3 block rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                    Development code: <strong dir="ltr">{devCode}</strong>
                  </span>
                )}
              </div>
            )}
            <button
              disabled={busy || (step === 'phone' && wait > 0)}
              onClick={step === 'phone' ? send : verify}
              className="mt-7 flex min-h-14 w-full items-center justify-center gap-3 rounded-[14px] bg-[linear-gradient(110deg,#5145d6,#6758e8)] px-5 font-black text-white shadow-[0_12px_26px_rgba(80,68,207,.24)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(80,68,207,.30)] focus-visible:ring-4 focus-visible:ring-[#6257db]/20 disabled:opacity-50"
            >
              {busy ? c.busy : step === 'phone' ? c.continue : c.verifyButton}
              <Arrow size={18} />
            </button>
            {step === 'phone' && googleAvailable && (
              <div className="mt-5">
                <div className="mb-5 flex items-center gap-4 text-xs font-medium text-[#9098aa] before:h-px before:flex-1 before:bg-[#e4e7ef] after:h-px after:flex-1 after:bg-[#e4e7ef]">
                  {translate(locale, 'authOr')}
                </div>
                <div ref={googleButton} className="flex min-h-11 w-full justify-center overflow-hidden" />
              </div>
            )}
            {step === 'phone' && (
              <div className="mt-6 border-t border-[#e4e7ef] pt-6">
                <p className="mb-5 text-center text-sm text-[#667089]">
                  {c.noAccount}{' '}
                  <Link
                    href={p(
                      phone ? routeTo.withQuery(routes.register, { identity: internationalPhone }) : routes.register,
                    )}
                    className="font-black text-[#554ad3] underline-offset-4 hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#6257db]/15"
                  >
                    {c.register}
                  </Link>
                </p>
                <p className="mb-4 text-center text-xs font-bold text-muted">{c.otherWays}</p>
                <Link
                  href={p(routes.login)}
                  className="flex min-h-14 w-full items-center justify-center rounded-[14px] border border-[#dce1eb] bg-white px-4 text-sm font-black text-[#28324d] transition hover:border-[#c9c3f2] hover:bg-[#faf9ff] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#6257db]/15"
                >
                  {c.passwordLogin}
                </Link>
                <Link
                  href={p(routes.forgotPassword)}
                  className="mt-4 block text-center text-sm font-bold text-blue hover:text-purple hover:underline"
                >
                  {c.forgotPassword}
                </Link>
              </div>
            )}
            {step === 'otp' && (
              <div className="mt-5">
                <div className="flex justify-between text-sm">
                  <button
                    onClick={() => {
                      setStep('phone');
                      setError(undefined);
                    }}
                    className="font-bold text-[#554ad3] hover:underline"
                  >
                    {c.edit}
                  </button>
                  <button
                    disabled={wait > 0 || busy}
                    onClick={send}
                    className="font-bold text-[#554ad3] disabled:text-[#9098aa]"
                  >
                    {wait ? c.resendWait : c.resend}
                  </button>
                </div>
                <ResendCountdown wait={wait} total={resendWindow} fa={fa} />
              </div>
            )}
            <p className="mt-8 flex items-center justify-center gap-2 text-xs text-muted">
              <ShieldCheck size={16} />
              {c.secure}
            </p>
            <p className="mt-8 text-center text-xs leading-6 text-muted">{c.terms}</p>
          </div>
        </section>
      </div>
    </main>
  );
}
