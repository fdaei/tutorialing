'use client';

import { useRef } from 'react';

/**
 * Maps Persian (۰-۹) and Arabic-Indic (٠-٩) digits onto ASCII so a code typed
 * or pasted with a Persian keyboard is accepted rather than silently dropped.
 */
export function toAsciiDigits(value: string) {
  return value
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}

const digitsOnly = (value: string) => toAsciiDigits(value).replace(/\D/g, '');

export const emptyOtp = (length: number) => Array.from({ length }, () => '');

/**
 * The value is an array of single characters rather than a string so that a
 * cleared box in the middle stays a gap instead of shifting later digits down.
 * Callers join it to get the code.
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  invalid,
  disabled,
  label = 'کد تأیید',
  className = '',
}: {
  value: string[];
  onChange: (next: string[]) => void;
  onComplete?: (code: string) => void;
  invalid?: boolean;
  disabled?: boolean;
  label?: string;
  className?: string;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const length = value.length;

  function write(next: string[]) {
    onChange(next);
    const code = next.join('');
    if (code.length === length) onComplete?.(code);
  }

  function change(index: number, raw: string) {
    const typed = digitsOnly(raw);
    const next = [...value];
    if (!typed) {
      next[index] = '';
      write(next);
      return;
    }
    // Typing overwrites the focused box and spills extra characters forward,
    // which also covers autofill delivering the whole code into the first box.
    for (let i = 0; i < typed.length && index + i < length; i += 1) next[index + i] = typed[i] ?? '';
    write(next);
    refs.current[Math.min(index + typed.length, length - 1)]?.focus();
  }

  function keyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace' && !value[index] && index > 0) {
      event.preventDefault();
      const next = [...value];
      next[index - 1] = '';
      write(next);
      refs.current[index - 1]?.focus();
      return;
    }
    // The row is rendered LTR, so ArrowLeft always means "the box before this one".
    if (event.key === 'ArrowLeft' && index > 0) refs.current[index - 1]?.focus();
    if (event.key === 'ArrowRight' && index < length - 1) refs.current[index + 1]?.focus();
  }

  function paste(event: React.ClipboardEvent) {
    const pasted = digitsOnly(event.clipboardData.getData('text')).slice(0, length);
    if (!pasted) return;
    event.preventDefault();
    write(Array.from({ length }, (_, i) => pasted[i] ?? ''));
    refs.current[Math.min(pasted.length, length - 1)]?.focus();
  }

  return (
    <div
      dir="ltr"
      role="group"
      aria-label={label}
      onPaste={paste}
      className={`grid gap-2 sm:gap-3 ${className}`}
      style={{ gridTemplateColumns: `repeat(${length}, minmax(0, 1fr))` }}
    >
      {value.map((digit, index) => (
        <input
          key={index}
          ref={(node) => {
            refs.current[index] = node;
          }}
          type="text"
          inputMode="numeric"
          // Only the first box carries one-time-code, otherwise the browser
          // offers to autofill the full code into every box.
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          aria-label={`رقم ${index + 1} از ${length}`}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          value={digit}
          onChange={(event) => change(index, event.target.value)}
          onKeyDown={(event) => keyDown(index, event)}
          onFocus={(event) => event.target.select()}
          className={`aspect-square min-w-0 rounded-2xl border bg-white text-center text-xl font-black text-[#3157e8] outline-none transition focus:border-[#3157e8] focus:ring-4 focus:ring-[#3157e8]/10 disabled:opacity-60 sm:text-2xl ${
            invalid ? 'border-red-400' : 'border-[#d5dce9]'
          }`}
        />
      ))}
    </div>
  );
}
