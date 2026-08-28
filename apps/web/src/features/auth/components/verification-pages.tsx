'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthDivider, AuthError, AuthHeading, AuthNotice, AuthShell, PrimaryButton } from './auth-shell';
import { PasswordInput } from './auth-fields';
import { OtpInput, emptyOtp } from './otp-input';
import { faNumber } from '@/lib/format';
import {
  OTP_LENGTH,
  authMessage,
  clearRecovery,
  displayPhone,
  readRecovery,
  resendRecoveryCode,
  saveNewPassword,
  verifyRecoveryCode,
  type RecoveryChallenge,
} from '../auth-service';

const clock = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

/**
 * Both screens are reachable by URL, but neither means anything without a
 * challenge in session storage. Returns `undefined` while the check is still
 * running so the caller can hold the render instead of flashing an empty form.
 */
function useRecoveryGuard(requireVerified = false) {
  const router = useRouter();
  const [challenge, setChallenge] = useState<RecoveryChallenge | null | undefined>();
  useEffect(() => {
    const current = readRecovery();
    if (!current || (requireVerified && !current.verified)) {
      setChallenge(null);
      router.replace('/forgot-password');
      return;
    }
    setChallenge(current);
  }, [router, requireVerified]);
  return challenge;
}

export function VerifyCodePage() {
  const router = useRouter();
  const challenge = useRecoveryGuard();
  const [digits, setDigits] = useState(() => emptyOtp(OTP_LENGTH));
  const [wait, setWait] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const code = digits.join('');

  useEffect(() => {
    if (challenge) setWait(challenge.resendIn);
  }, [challenge]);

  useEffect(() => {
    if (!wait) return;
    const timer = setInterval(() => setWait((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [wait]);

  async function verify(submitted: string) {
    if (busy) return;
    setError('');
    if (submitted.length !== OTP_LENGTH) {
      setError(`لطفاً هر ${faNumber(OTP_LENGTH)} رقم کد تأیید را وارد کنید`);
      return;
    }
    setBusy(true);
    try {
      await verifyRecoveryCode(submitted);
      router.push('/reset-password');
    } catch (caught) {
      setError(authMessage(caught, 'کد تأیید وارد شده صحیح نیست'));
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (wait || busy) return;
    setBusy(true);
    setError('');
    try {
      const next = await resendRecoveryCode();
      setWait(next.resendIn);
      setDigits(emptyOtp(OTP_LENGTH));
    } catch (caught) {
      setError(authMessage(caught, 'ارسال مجدد انجام نشد'));
    } finally {
      setBusy(false);
    }
  }

  if (challenge === undefined) return null;

  return (
    <AuthShell illustration="/images/auth/verify.png" illustrationAlt="تصویر سه‌بعدی تلفن همراه و سپر تأیید">
      <AuthHeading
        title="تأیید کد"
        description={`کد ${faNumber(OTP_LENGTH)} رقمی ارسال شده به شماره موبایل یا ایمیل شما را وارد کنید`}
      />
      {challenge && (
        <p className="-mt-4 mb-7 text-center text-sm text-[#7b879f]">
          کد به{' '}
          <b dir="ltr" className="inline-block font-bold text-[#0b1938]">
            {displayPhone(challenge.phone)}
          </b>{' '}
          ارسال شد
        </p>
      )}
      {challenge?.developmentCode && (
        <AuthNotice>
          کد تست (فقط در محیط توسعه):{' '}
          <b dir="ltr" className="inline-block">
            {challenge.developmentCode}
          </b>
        </AuthNotice>
      )}
      <form
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          verify(code);
        }}
      >
        <OtpInput
          className="mt-6"
          value={digits}
          onChange={setDigits}
          onComplete={verify}
          disabled={busy}
          invalid={Boolean(error)}
          label="کد تأیید"
        />
        <div aria-live="polite" className="mt-7 text-center text-sm text-[#7e899d]">
          {wait ? (
            <>
              ارسال مجدد کد تا{' '}
              <b dir="ltr" className="inline-block font-medium text-[#3157e8]">
                {clock(wait)}
              </b>
            </>
          ) : (
            <button
              type="button"
              onClick={resend}
              disabled={busy}
              className="font-black text-[#3157e8] hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#3157e8]/20 disabled:opacity-60"
            >
              ارسال مجدد کد
            </button>
          )}
        </div>
        <AuthError>{error}</AuthError>
        <PrimaryButton busy={busy}>{busy ? 'در حال تأیید...' : 'تأیید'}</PrimaryButton>
      </form>
      <div className="mt-7 space-y-5 text-center">
        <Link href="/forgot-password" className="block font-bold text-[#3157e8] hover:underline">
          ویرایش شماره یا ایمیل
        </Link>
        <AuthDivider className="" />
        <Link href="/login" className="block font-black text-[#3157e8] hover:underline">
          بازگشت به ورود
        </Link>
      </div>
    </AuthShell>
  );
}

export function ResetPasswordPage() {
  const router = useRouter();
  const challenge = useRecoveryGuard(true);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!password) next.password = 'لطفاً رمز عبور جدید را وارد کنید';
    else if (password.length < 8) next.password = 'رمز عبور باید حداقل ۸ کاراکتر باشد';
    if (!confirm) next.confirm = 'لطفاً تکرار رمز عبور را وارد کنید';
    else if (password !== confirm) next.confirm = 'رمزهای عبور با یکدیگر مطابقت ندارند';
    setErrors(next);
    setError('');
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await saveNewPassword(password);
      clearRecovery();
      router.replace('/login?reset=success');
    } catch (caught) {
      setError(authMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  if (challenge === undefined) return null;

  return (
    <AuthShell illustration="/images/auth/reset.png" illustrationAlt="تصویر سه‌بعدی قفل و فرم رمز عبور">
      <AuthHeading title="تنظیم رمز عبور جدید" description="رمز عبور جدید خود را وارد کرده و آن را تأیید کنید" />
      <form onSubmit={submit} noValidate className="space-y-5">
        <PasswordInput
          label="رمز عبور جدید"
          placeholder="رمز عبور جدید را وارد کنید"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          hint="رمز عبور باید حداقل ۸ کاراکتر باشد"
        />
        <PasswordInput
          label="تکرار رمز عبور جدید"
          placeholder="رمز عبور جدید را دوباره وارد کنید"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={errors.confirm}
        />
        <AuthError>{error}</AuthError>
        <PrimaryButton busy={busy}>{busy ? 'در حال ذخیره...' : 'ذخیره رمز عبور'}</PrimaryButton>
      </form>
      <AuthDivider className="mt-8" />
      <p className="mt-7 text-center">
        <Link href="/login" className="font-black text-[#3157e8] hover:underline">
          بازگشت به ورود
        </Link>
      </p>
    </AuthShell>
  );
}
