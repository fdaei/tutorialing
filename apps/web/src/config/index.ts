import { webDefaults } from './defaults';

export { brandAssets } from './defaults';

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

/**
 * Teacher discovery (the public directory, teacher profiles, and the matching
 * flow) is paused in the current UX. Only the frontend entry points are gated:
 * the teachers/matching APIs, student match history, and teacher data stay live.
 * Set NEXT_PUBLIC_FEATURE_TEACHER_DISCOVERY=true and rebuild (NEXT_PUBLIC_* is
 * inlined at build time) to bring every link and route back.
 */
export const featureFlags = {
  teacherDiscovery: process.env.NEXT_PUBLIC_FEATURE_TEACHER_DISCOVERY === 'true',
};

const TEACHER_DISCOVERY_PATH = /^(?:\/en)?\/(?:teachers|matching)(?=[/?#]|$)/;

/** True for web paths that belong to teacher discovery, with or without the /en prefix. */
export function isTeacherDiscoveryPath(href: string) {
  return TEACHER_DISCOVERY_PATH.test(href);
}

/** Whether a link should be rendered, given the teacher-discovery flag. */
export function isLinkEnabled(href: string, teacherDiscovery = featureFlags.teacherDiscovery) {
  return teacherDiscovery || !isTeacherDiscoveryPath(href);
}

/** `tel:` target for the configured contact number; a local Iranian 0-prefixed number becomes +98. */
export const contactPhoneHref = `tel:${webConfig.contactPhone.replace(/[^\d+]/g, '').replace(/^0/, '+98')}`;
