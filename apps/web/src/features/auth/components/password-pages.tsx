'use client';

import Link from 'next/link';
import { Mail, UserRound } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthDivider, AuthError, AuthFooter, AuthHeading, AuthNotice, AuthShell, PrimaryButton } from './auth-shell';
import { AuthInput, PasswordInput, TermsCheckbox } from './auth-fields';
import { GoogleAuthButton } from './google-auth-button';
import { authMessage, googleAuth, loginWithPassword, registerWithPassword, sendRecoveryCode } from '../auth-service';

type Errors = Record<string, string>;

/** Keeps password and passwordless sign-in available side by side. */
function OtpFallbackHint() {
  return (
    <p className="mt-5 text-center text-xs leading-6 text-[#8993a7]">
      یا با{' '}
      <Link href="/auth" className="font-bold text-[#3157e8] hover:underline">
        ورود امن با کد یک‌بارمصرف
      </Link>{' '}
      ادامه دهید
    </p>
  );
}

export function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [values, setValues] = useState({ identity: '', password: '' });
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const passwordJustReset = params.get('reset') === 'success';

  async function submit(event: FormEvent) {
    event.preventDefault();
    const next: Errors = {};
    if (!values.identity.trim()) next.identity = 'لطفاً ایمیل یا شماره موبایل خود را وارد کنید';
    if (!values.password) next.password = 'لطفاً رمز عبور را وارد کنید';
    setErrors(next);
    setError('');
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await loginWithPassword(values.identity, values.password);
      router.replace('/dashboard');
    } catch (caught) {
      setError(authMessage(caught, 'ایمیل، شماره موبایل یا رمز عبور اشتباه است'));
    } finally {
      setBusy(false);
    }
  }

  async function onGoogleCredential(credential: string) {
    setBusy(true);
    setError('');
    try {
      await googleAuth(credential);
      router.replace('/dashboard');
    } catch (caught) {
      setError(authMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell illustration="/images/auth/login.png" illustrationAlt="تصویر سه‌بعدی سپر و قفل امنیتی">
      <AuthHeading title="ورود" description="برای ادامه وارد حساب کاربری خود شوید" />
      {passwordJustReset && <AuthNotice>رمز عبور شما با موفقیت تغییر کرد</AuthNotice>}
      <form onSubmit={submit} noValidate className="space-y-5">
        <AuthInput
          label="ایمیل یا شماره موبایل"
          placeholder="ایمیل یا شماره موبایل خود را وارد کنید"
          autoComplete="username"
          icon={<Mail size={22} />}
          value={values.identity}
          onChange={(e) => setValues({ ...values, identity: e.target.value })}
          error={errors.identity}
        />
        <PasswordInput
          label="رمز عبور"
          placeholder="رمز عبور خود را وارد کنید"
          autoComplete="current-password"
          value={values.password}
          onChange={(e) => setValues({ ...values, password: e.target.value })}
          error={errors.password}
        />
        <div className="-mt-1 text-right">
          <Link href="/forgot-password" className="text-sm font-bold text-[#3157e8] hover:underline">
            رمز عبور را فراموش کرده‌اید؟
          </Link>
        </div>
        <AuthError>{error}</AuthError>
        <PrimaryButton busy={busy}>{busy ? 'در حال ورود...' : 'ورود'}</PrimaryButton>
      </form>
      <AuthDivider />
      <GoogleAuthButton label="ورود با گوگل" disabled={busy} onCredential={onGoogleCredential} onError={setError} />
      <OtpFallbackHint />
      <AuthFooter question="حساب کاربری ندارید؟" href="/register" action="ثبت نام" />
    </AuthShell>
  );
}

export function RegisterPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [values, setValues] = useState({
    name: '',
    identity: params.get('identity') ?? '',
    password: '',
    confirm: '',
    terms: false,
  });
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const next: Errors = {};
    if (!values.name.trim()) next.name = 'لطفاً نام و نام خانوادگی خود را وارد کنید';
    if (!values.identity.trim()) next.identity = 'لطفاً ایمیل یا شماره موبایل خود را وارد کنید';
    if (!values.password) next.password = 'لطفاً رمز عبور را وارد کنید';
    else if (values.password.length < 8) next.password = 'رمز عبور باید حداقل ۸ کاراکتر باشد';
    if (!values.confirm) next.confirm = 'لطفاً تکرار رمز عبور را وارد کنید';
    else if (values.password !== values.confirm) next.confirm = 'رمزهای عبور با یکدیگر مطابقت ندارند';
    if (!values.terms) next.terms = 'برای ایجاد حساب باید قوانین و مقررات را بپذیرید';
    setErrors(next);
    setError('');
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await registerWithPassword({ name: values.name, identity: values.identity, password: values.password });
      router.replace('/dashboard');
    } catch (caught) {
      setError(authMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function onGoogleCredential(credential: string) {
    setBusy(true);
    setError('');
    try {
      await googleAuth(credential);
      router.replace('/dashboard');
    } catch (caught) {
      setError(authMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell illustration="/images/auth/register.png" illustrationAlt="تصویر سه‌بعدی کارت ساخت حساب کاربری" compact>
      <AuthHeading title="ثبت نام" description="برای ایجاد حساب کاربری اطلاعات خود را وارد کنید" />
      <form onSubmit={submit} noValidate className="space-y-4">
        <AuthInput
          label="نام و نام خانوادگی"
          placeholder="نام و نام خانوادگی خود را وارد کنید"
          autoComplete="name"
          icon={<UserRound size={22} />}
          value={values.name}
          onChange={(e) => setValues({ ...values, name: e.target.value })}
          error={errors.name}
        />
        <AuthInput
          label="ایمیل یا شماره موبایل"
          placeholder="ایمیل یا شماره موبایل خود را وارد کنید"
          autoComplete="username"
          icon={<Mail size={22} />}
          value={values.identity}
          onChange={(e) => setValues({ ...values, identity: e.target.value })}
          error={errors.identity}
        />
        <PasswordInput
          label="رمز عبور"
          placeholder="رمز عبور خود را وارد کنید"
          autoComplete="new-password"
          value={values.password}
          onChange={(e) => setValues({ ...values, password: e.target.value })}
          error={errors.password}
        />
        <PasswordInput
          label="تکرار رمز عبور"
          placeholder="رمز عبور را دوباره وارد کنید"
          autoComplete="new-password"
          value={values.confirm}
          onChange={(e) => setValues({ ...values, confirm: e.target.value })}
          error={errors.confirm}
        />
        <TermsCheckbox
          checked={values.terms}
          onChange={(terms) => setValues({ ...values, terms })}
          error={errors.terms}
          termsHref="/terms"
        />
        <AuthError>{error}</AuthError>
        <PrimaryButton busy={busy}>{busy ? 'در حال ایجاد حساب...' : 'ایجاد حساب'}</PrimaryButton>
      </form>
      <AuthDivider />
      <GoogleAuthButton label="ثبت نام با گوگل" disabled={busy} onCredential={onGoogleCredential} onError={setError} />
      <OtpFallbackHint />
      <AuthFooter question="حساب کاربری دارید؟" href="/login" action="ورود" />
    </AuthShell>
  );
}

export function ForgotPasswordPage() {
  const router = useRouter();
  const [identity, setIdentity] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (!identity.trim()) {
      setFieldError('لطفاً ایمیل یا شماره موبایل خود را وارد کنید');
      return;
    }
    setFieldError('');
    setBusy(true);
    try {
      await sendRecoveryCode(identity);
      router.push('/verify-code');
    } catch (caught) {
      setError(authMessage(caught, 'ارسال کد انجام نشد. دوباره تلاش کنید'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell illustration="/images/auth/forgot.png" illustrationAlt="تصویر سه‌بعدی پاکت نامه و کلید بازیابی">
      <AuthHeading
        title="بازیابی رمز عبور"
        description="ایمیل یا شماره موبایل خود را وارد کنید تا کد تأیید برای شما ارسال شود"
      />
      <form onSubmit={submit} noValidate>
        <AuthInput
          label="ایمیل یا شماره موبایل"
          placeholder="ایمیل یا شماره موبایل خود را وارد کنید"
          inputMode="tel"
          autoComplete="tel"
          icon={<Mail size={22} />}
          value={identity}
          onChange={(e) => setIdentity(e.target.value)}
          error={fieldError}
        />
        <AuthError>{error}</AuthError>
        <PrimaryButton busy={busy}>{busy ? 'در حال ارسال...' : 'ارسال کد تأیید'}</PrimaryButton>
      </form>
      <p className="mt-8 text-center">
        <Link href="/login" className="font-black text-[#3157e8] hover:underline">
          بازگشت به ورود
        </Link>
      </p>
    </AuthShell>
  );
}
