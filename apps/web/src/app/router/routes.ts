/**
 * Canonical application paths. Next.js still owns route matching through the
 * app directory; this module owns links and redirects used by application code.
 */
export const routes = {
  home: '/',
  auth: '/auth',
  login: '/login',
  register: '/register',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  verifyCode: '/verify-code',
  panel: '/panel',
  dashboard: '/dashboard',
  admin: '/admin',
  teacherPanel: '/teacher-panel',
  teachers: '/teachers',
  matching: '/matching',
  placement: '/placement',
  checkout: '/checkout',
  languages: '/languages',
  courses: '/courses',
  blog: '/blog',
  teach: '/teach',
  teacherApply: '/teacher-apply',
  paymentSuccess: '/payment/success',
  paymentFailure: '/payment/failure',
  paymentPending: '/payment/pending',
  testDeviceCheck: '/test/device-check',
  testSession: '/test/session',
} as const;

export type StaticRoute = (typeof routes)[keyof typeof routes];
export type PanelSection = 'classes' | 'tests' | 'matches' | 'plan' | 'wallet' | 'notifications' | 'tickets' | 'profile';
export type TeacherPanelSection =
  | 'profile'
  | 'availability'
  | 'classes'
  | 'students'
  | 'plans'
  | 'pricing'
  | 'earnings'
  | 'tickets'
  | 'reviews'
  | 'notifications'
  | 'settings'
  | 'more';

const segment = (value: string | number) => encodeURIComponent(String(value));

export const routeTo = {
  adminSection: (section: string) => `${routes.admin}/${segment(section)}` as const,
  dashboardSection: (section: PanelSection) => `${routes.dashboard}/${section}` as const,
  teacherPanelSection: (section: TeacherPanelSection) => `${routes.teacherPanel}/${section}` as const,
  teacher: (idOrSlug: string) => `${routes.teachers}/${segment(idOrSlug)}` as const,
  language: (slug: string) => `${routes.languages}/${segment(slug)}` as const,
  course: (slug: string) => `${routes.courses}/${segment(slug)}` as const,
  blogPost: (slug: string) => `${routes.blog}/${segment(slug)}` as const,
  withQuery: <TPath extends string>(path: TPath, query: Record<string, string | number | boolean | undefined>) => {
    const search = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined) search.set(key, String(value));
    });
    const value = search.toString();
    return (value ? `${path}?${value}` : path) as TPath | `${TPath}?${string}`;
  },
};
