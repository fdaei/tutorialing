import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { forwardRef } from 'react';
import { cn } from './cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'brand' | 'light';
export type ButtonSize = 'sm' | 'md' | 'lg';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-white shadow-sm hover:bg-primary-hover',
  secondary: 'border border-[#d5dae6] bg-white text-ink hover:border-[#c7cdfb] hover:bg-primary-soft hover:text-primary-hover',
  ghost: 'text-muted hover:bg-canvas hover:text-ink',
  danger: 'bg-danger text-white shadow-sm hover:bg-red-800',
  // Gradient is reserved for marketing moments (hero / final CTA), not app actions.
  brand: 'bg-brand text-white shadow-brand hover:brightness-110',
  light: 'bg-white text-ink shadow-sm hover:bg-lavender',
};
const sizes: Record<ButtonSize, string> = {
  sm: 'min-h-9 gap-1.5 rounded-lg px-3 text-sm',
  md: 'min-h-11 gap-2 rounded-xl px-4 text-sm',
  lg: 'min-h-13 gap-2.5 rounded-xl px-6 text-base',
};

export function buttonClass({
  variant = 'primary',
  size = 'md',
  block,
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; block?: boolean; className?: string } = {}) {
  return cn(
    'inline-flex select-none items-center justify-center whitespace-nowrap font-bold transition disabled:pointer-events-none disabled:opacity-50',
    variants[variant],
    sizes[size],
    block && 'w-full',
    className,
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, block, loading, icon, className, children, disabled, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass({ variant, size, block, className })}
      {...props}
    >
      {loading ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : icon}
      {children}
    </button>
  );
});

export function ButtonLink({
  href,
  variant,
  size,
  block,
  icon,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<typeof Link>, 'className'> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <Link href={href} className={buttonClass({ variant, size, block, className })} {...props}>
      {icon}
      {children}
    </Link>
  );
}
