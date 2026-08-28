import { webDefaults } from './defaults';

// Keep explicit NEXT_PUBLIC_* reads so Next.js can inline them in client code.
export const webConfig = {
  nodeEnv: process.env.NODE_ENV || webDefaults.nodeEnv,
  apiUrl: process.env.NEXT_PUBLIC_API_URL || webDefaults.apiUrl,
  webUrl: process.env.NEXT_PUBLIC_WEB_URL || webDefaults.webUrl,
  s3Origin: process.env.NEXT_PUBLIC_S3_ORIGIN || webDefaults.s3Origin,
  enamadHtml: process.env.NEXT_PUBLIC_ENAMAD_HTML || webDefaults.enamadHtml,
  contactPhone: process.env.NEXT_PUBLIC_CONTACT_PHONE || webDefaults.contactPhone,
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL || webDefaults.contactEmail,
  googleClientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || webDefaults.googleClientId,
  localeCookieMaxAgeSeconds:
    Number(process.env.NEXT_PUBLIC_LOCALE_COOKIE_MAX_AGE_SECONDS) || webDefaults.localeCookieMaxAgeSeconds,
};
