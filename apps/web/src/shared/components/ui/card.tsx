import { cn } from './cn';

export function Card({
  as: Tag = 'section',
  padded = true,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLElement> & { as?: 'section' | 'article' | 'div' | 'aside'; padded?: boolean }) {
  return (
    <Tag className={cn('panel-card', padded && 'p-4 sm:p-6', className)} {...props}>
      {children}
    </Tag>
  );
}

export function CardHeader({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('mb-4 flex items-start justify-between gap-3', className)}>
      <div className="flex min-w-0 items-start gap-3">
        {icon && (
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">{icon}</span>
        )}
        <div className="min-w-0">
          <h2 className="text-h3 text-ink">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

/** Page title block for app screens. Stops at h1 size — display sizes are for marketing pages. */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-sm font-bold text-primary">{eyebrow}</p>}
        <h1 className="text-2xl font-black leading-10 text-ink md:text-h1">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm leading-7 text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Stat({
  label,
  value,
  hint,
  icon,
  tone = 'primary',
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: 'primary' | 'success' | 'warning' | 'danger' | 'accent';
}) {
  const toneClass = {
    primary: 'bg-primary-soft text-primary',
    success: 'bg-success-soft text-success',
    warning: 'bg-warning-soft text-warning',
    danger: 'bg-danger-soft text-danger',
    accent: 'bg-lavender text-purple',
  }[tone];
  return (
    <div className="panel-card flex items-start gap-3 p-4">
      {icon && <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', toneClass)}>{icon}</span>}
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted">{label}</p>
        <p className="mt-0.5 truncate text-xl font-black text-ink">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      </div>
    </div>
  );
}
