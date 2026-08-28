import { routes, type StaticRoute } from './routes';

export type RouteAccess = 'public' | 'authenticated' | 'admin' | 'teacher';

export type RouteDefinition = Readonly<{
  path: StaticRoute;
  access: RouteAccess;
  errorScope: 'app' | 'route';
}>;

export const routeConfig = {
  home: { path: routes.home, access: 'public', errorScope: 'app' },
  auth: { path: routes.auth, access: 'public', errorScope: 'route' },
  dashboard: { path: routes.dashboard, access: 'authenticated', errorScope: 'route' },
  admin: { path: routes.admin, access: 'admin', errorScope: 'route' },
  teacherPanel: { path: routes.teacherPanel, access: 'teacher', errorScope: 'route' },
  checkout: { path: routes.checkout, access: 'authenticated', errorScope: 'route' },
  matching: { path: routes.matching, access: 'authenticated', errorScope: 'route' },
  placement: { path: routes.placement, access: 'authenticated', errorScope: 'route' },
} as const satisfies Record<string, RouteDefinition>;

export type RouteName = keyof typeof routeConfig;
