import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

/**
 * Route × authorization matrix (Phase 2 / Phase 4).
 *
 * Every HTTP route must make a deliberate access decision. This test parses
 * every controller and forces each route into exactly one of three buckets:
 *
 *   1. `@Public()`            — deliberately unauthenticated
 *   2. `@Roles`/`@Permissions` — role- or permission-gated
 *   3. SELF_SCOPED            — authenticated, no role gate, because the service
 *                               filters by the caller's own id
 *
 * Bucket 3 is an explicit allowlist below. A new route that lands there without
 * being added fails this test, so "I forgot to add a guard" cannot ship quietly.
 *
 * Parsing note: several files declare more than one `@Controller` (e.g.
 * `LanguagesController` at `/languages` and `AdminLanguagesController` at
 * `/admin/languages`, the latter carrying class-level `@Roles`/`@Permissions`).
 * An earlier version of this parser read only the first `@Controller` per file
 * and produced false "unguarded admin route" findings. Class-level decorators
 * are inherited by every route in that class.
 */

const SRC = __dirname;

function controllerFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return controllerFiles(full);
    return full.endsWith('.controller.ts') ? [full] : [];
  });
}

type Route = {
  method: string;
  path: string;
  file: string;
  public: boolean;
  roles: boolean;
  permissions: boolean;
  rateLimited: boolean;
};

const CONTROLLER = /@Controller\(\s*'([^']*)'\s*\)/g;
const HTTP = /@(Get|Post|Patch|Put|Delete)\(\s*(?:'([^']*)')?\s*\)/g;

function parseRoutes(): Route[] {
  const out: Route[] = [];
  for (const file of controllerFiles(join(SRC, 'modules'))) {
    const src = readFileSync(file, 'utf8');
    const controllers = [...src.matchAll(CONTROLLER)];
    controllers.forEach((ctrl, index) => {
      const base = `/${ctrl[1] ?? ''}`;
      const bodyStart = (ctrl.index ?? 0) + ctrl[0].length;
      const bodyEnd = index + 1 < controllers.length ? (controllers[index + 1]?.index ?? src.length) : src.length;
      const prevEnd = index === 0 ? 0 : ((controllers[index - 1]?.index ?? 0) + (controllers[index - 1]?.[0].length ?? 0));

      // This class's own decorators sit between the end of the previous class
      // and this @Controller.
      const pre = src.slice(prevEnd, ctrl.index ?? 0);
      const classDecorators = pre.includes('}') ? pre.slice(pre.lastIndexOf('}') + 1) : pre;
      // `@Authorize(roles, permissions)` and `@PublicRateLimit(options)` are
      // composed decorators (see common/decorators/*) that bundle the same
      // metadata `@Roles`/`@Permissions` and `@Public`/`@RateLimit` set
      // individually — recognise them as equivalent so a route using the
      // composed form isn't misread as having no access decision.
      const classRoles = /@Roles\(|@Authorize\(/.test(classDecorators);
      const classPerms = /@Permissions\(|@Authorize\(/.test(classDecorators);
      const classPublic = /@Public\(\)|@PublicRateLimit\(/.test(classDecorators);

      const body = src.slice(bodyStart, bodyEnd);
      const hits = [...body.matchAll(HTTP)];
      hits.forEach((hit, i) => {
        const from = i === 0 ? 0 : (hits[i - 1]?.index ?? 0) + (hits[i - 1]?.[0].length ?? 0);
        const seg = body.slice(from, hit.index ?? 0);
        const sub = hit[2] ?? '';
        out.push({
          method: hit[1] ?? '',
          path: `${base.replace(/\/$/, '')}/${sub.replace(/^\//, '')}`.replace(/\/$/, '') || '/',
          file: relative(SRC, file),
          public: classPublic || /@Public\(\)|@PublicRateLimit\(/.test(seg),
          roles: classRoles || /@Roles\(|@Authorize\(/.test(seg),
          permissions: classPerms || /@Permissions\(|@Authorize\(/.test(seg),
          rateLimited: /@RateLimit\(|@PublicRateLimit\(/.test(seg),
        });
      });
    });
  }
  return out;
}

/**
 * Authenticated routes that intentionally carry no role gate because the
 * service scopes the query to the caller. Each was read and confirmed in
 * AUDIT/02-security.md §2.2 — none is an IDOR.
 */
const SELF_SCOPED = new Set([
  'POST /bookings', 'GET /bookings/me', 'POST /bookings/:id/cancel',
  'POST /bookings/:id/reschedule', 'POST /bookings/:id/reschedule/accept',
  'POST /bookings/:id/reschedule/decline',
  'GET /packages/enrollments/me',
  'POST /payments', 'POST /payments/:id/gateway', 'GET /payments/wallet',
  'GET /payments/wallet/transactions', 'GET /payments/invoices',
  'POST /files/uploads', 'POST /files/uploads/:id/content', 'POST /files/:id/complete',
  'GET /files/:id/download',
  'GET /learning/plans', 'POST /learning/assignments/:id/submit',
  'POST /matching', 'GET /matching/history',
  'GET /notifications', 'PUT /notifications/:id/read',
  'POST /support/tickets', 'GET /support/tickets', 'GET /support/tickets/:id',
  'POST /support/tickets/:id/replies',
  'POST /reviews',
  'POST /teacher/application', 'PATCH /teacher/application', 'POST /teacher/application/submit',
  'POST /tests/attempts', 'GET /tests/attempts/history', 'GET /tests/attempts/:id',
  'PATCH /tests/attempts/:id/answers', 'POST /tests/attempts/:id/sections/:sectionId/submit',
  'POST /tests/attempts/:id/submit',
  'GET /users/me', 'PUT /users/me', 'PUT /users/me/locale',
  'GET /users/me/favorites', 'PUT /users/me/favorites/:teacherId',
  'DELETE /users/me/favorites/:teacherId',
]);

const routes = parseRoutes();
const key = (r: Route) => `${r.method.toUpperCase()} ${r.path}`;

describe('route authorization matrix', () => {
  it('parses the whole controller surface', () => {
    expect(routes.length).toBeGreaterThanOrEqual(139);
  });

  it('gives every route a deliberate access decision', () => {
    const undecided = routes
      .filter((r) => !r.public && !r.roles && !r.permissions && !SELF_SCOPED.has(key(r)))
      .map((r) => `${key(r)}  (${r.file})`);

    // A new route lands here until it is either guarded or explicitly declared
    // self-scoped. Do not add to SELF_SCOPED without checking the service
    // actually filters by the caller's id.
    expect(undecided).toEqual([]);
  });

  it('keeps the public surface small and known', () => {
    const publicRoutes = routes.filter((r) => r.public).map(key).sort();
    // Growth here is a security decision, so it must be a deliberate edit.
    expect(publicRoutes.length).toBeLessThanOrEqual(16);
    expect(publicRoutes).toEqual(expect.arrayContaining([
      'POST /auth/otp/request',
      'POST /auth/otp/verify',
    ]));
  });

  it('rate-limits every unauthenticated write route', () => {
    // Public + state-changing + unthrottled is free abuse: OTP costs real SMS
    // money and the payment callback is reachable by anyone.
    const unprotected = routes
      .filter((r) => r.public && r.method.toUpperCase() !== 'GET' && !r.rateLimited)
      .map((r) => `${key(r)}  (${r.file})`);
    expect(unprotected).toEqual([]);
  });

  it('rate-limits the slot-allocating booking routes (SEC-205)', () => {
    const mustThrottle = ['POST /bookings', 'POST /bookings/:id/cancel', 'POST /bookings/:id/reschedule'];
    for (const target of mustThrottle) {
      const route = routes.find((r) => key(r) === target);
      expect(route).toBeDefined();
      expect(route?.rateLimited).toBe(true);
    }
  });
});
