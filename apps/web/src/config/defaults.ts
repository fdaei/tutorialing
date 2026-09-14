export const webDefaults = {
  nodeEnv: 'development',
  apiUrl: 'http://localhost:4001/api',
  webUrl: 'http://localhost:3000',
  s3Origin: '',
  enamadHtml: '',
  contactPhone: '0991 467 3683',
  contactEmail: 'Arezoo.ahmadi.39@gmail.com',
  googleClientId: '',
  localeCookieMaxAgeSeconds: 31_536_000,
  e2eServerTimeoutMs: 120_000,
} as const;

/** Static brand artwork served from apps/web/public. */
export const brandAssets = {
  /** Full logo (mark + wordmark), used in the header and footer. */
  logo: '/images/brand/lingospeak-logo.png',
  /** The "L" mark alone, used as the favicon and app icon. */
  mark: '/images/brand/lingospeak-mark.png',
} as const;
