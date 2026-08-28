'use client';

import { Eye, EyeOff } from 'lucide-react';
import { forwardRef, useId, useState } from 'react';

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
};

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-2 block text-right text-sm font-bold text-[#28324d]">
      {children}
    </label>
  );
}

function FieldMessages({ id, error, hint }: { id: string; error?: string; hint?: string }) {
  if (error)
    return (
      <span id={id} role="alert" className="mt-2 block text-right text-xs text-red-600">
        {error}
      </span>
    );
  if (hint)
    return (
      <span id={id} className="mt-2 block text-right text-xs text-[#8893a8]">
        {hint}
      </span>
    );
  return null;
}

const shell = (error?: string) =>
  `flex min-h-[56px] items-center rounded-[14px] border bg-[#fbfcfe] px-3 transition hover:bg-white focus-within:border-[#6257db] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#6257db]/10 ${
    error ? 'border-red-400' : 'border-[#dce1eb]'
  }`;

export const AuthInput = forwardRef<HTMLInputElement, FieldProps & { icon?: React.ReactNode }>(function AuthInput(
  { label, error, hint, icon, className = '', id, ...props },
  ref,
) {
  const generated = useId();
  const inputId = id ?? generated;
  const messageId = `${inputId}-message`;
  return (
    <div className="text-right">
      <FieldLabel htmlFor={inputId}>{label}</FieldLabel>
      <div className={shell(error)}>
        {icon && (
          <span aria-hidden className="pr-1 text-[#8991a5]">
            {icon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          {...props}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? messageId : undefined}
          className={`min-w-0 flex-1 bg-transparent px-3 py-4 text-right text-[15px] outline-none placeholder:text-[#a0a9bb] ${className}`}
        />
      </div>
      <FieldMessages id={messageId} error={error} hint={hint} />
    </div>
  );
});

export function PasswordInput({ label, error, hint, id, ...props }: Omit<FieldProps, 'type'>) {
  const [shown, setShown] = useState(false);
  const generated = useId();
  const inputId = id ?? generated;
  const messageId = `${inputId}-message`;
  return (
    <div className="text-right">
      <FieldLabel htmlFor={inputId}>{label}</FieldLabel>
      <div className={shell(error)}>
        <input
          id={inputId}
          {...props}
          type={shown ? 'text' : 'password'}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? messageId : undefined}
          className="min-w-0 flex-1 bg-transparent px-2 py-4 text-right text-[15px] outline-none placeholder:text-[#a0a9bb]"
        />
        <button
          type="button"
          onClick={() => setShown((value) => !value)}
          aria-label={shown ? 'پنهان کردن رمز عبور' : 'نمایش رمز عبور'}
          aria-pressed={shown}
          aria-controls={inputId}
          className="grid size-10 shrink-0 place-items-center rounded-xl text-[#758198] transition hover:bg-[#f1f4fa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3157e8]/30"
        >
          {shown ? <EyeOff size={22} aria-hidden /> : <Eye size={22} aria-hidden />}
        </button>
      </div>
      <FieldMessages id={messageId} error={error} hint={hint} />
    </div>
  );
}

export function TermsCheckbox({
  checked,
  onChange,
  error,
  termsHref,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  error?: string;
  termsHref?: string;
}) {
  const id = useId();
  const messageId = `${id}-message`;
  return (
    <div>
      <div className="flex items-start gap-3 pt-1 text-sm text-[#667189]">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? messageId : undefined}
          className="mt-0.5 size-5 shrink-0 cursor-pointer rounded accent-[#3157e8]"
        />
        <label htmlFor={id} className="cursor-pointer leading-6">
          {termsHref ? (
            <a
              href={termsHref}
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-[#3157e8] hover:underline"
            >
              قوانین و مقررات
            </a>
          ) : (
            <span className="font-bold text-[#3157e8]">قوانین و مقررات</span>
          )}{' '}
          را می‌پذیرم
        </label>
      </div>
      {error && (
        <p id={messageId} role="alert" className="mt-2 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
