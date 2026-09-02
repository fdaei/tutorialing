export type ErrorContext = Readonly<{
  scope: 'app' | 'route' | 'feature' | 'widget';
  name?: string;
  componentStack?: string;
}>;

export function logError(error: unknown, context: ErrorContext): void {
  const safeError = error instanceof Error ? { name: error.name, message: error.message } : { name: 'UnknownError' };
  console.error('[ui-error]', safeError, context);
}
