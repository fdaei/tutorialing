export type PanelIdentity = { roles?: string[]; permissions?: string[] };

const rolesOf = (identity: PanelIdentity) => (Array.isArray(identity.roles) ? identity.roles : []);
const permissionsOf = (identity: PanelIdentity) =>
  Array.isArray(identity.permissions) ? identity.permissions : [];

const hasRole = (identity: PanelIdentity, ...roles: string[]) =>
  rolesOf(identity).some((role) => roles.includes(role));
const hasPermission = (identity: PanelIdentity, permission: string) =>
  permissionsOf(identity).includes(permission);
/** ADMIN and STAFF reach every admin section, so every admin rule starts here. */
const isAdmin = (identity: PanelIdentity) => hasRole(identity, 'ADMIN', 'STAFF');

export function panelHome(identity: PanelIdentity) {
  if (isAdmin(identity)) return '/admin';
  if (hasRole(identity, 'SUPPORT') && hasPermission(identity, 'tickets.read')) return '/admin/tickets';
  if (hasRole(identity, 'FINANCE')) {
    if (hasPermission(identity, 'teacher-prices.manage')) return '/admin/teacher-prices';
    if (hasPermission(identity, 'payouts.manage')) return '/admin/payouts';
    if (hasPermission(identity, 'payments.refund')) return '/admin/refunds';
  }
  if (hasRole(identity, 'EXAMINER')) return '/admin/test-reviews';
  if (hasRole(identity, 'TEACHER')) return '/teacher-panel';
  return '/dashboard';
}

/**
 * Explicit allow-list of post-login destinations. Anything not matched here is
 * denied, so a route added later is unreachable via `?next=` until it is listed
 * — the safe direction to fail. Patterns are anchored and end at a segment
 * boundary so `/admin-backdoor` cannot ride in on the `/admin` entry.
 *
 * Order matters: the narrow `/admin/*` sections must precede the catch-all
 * `/admin` rule that only admins satisfy.
 */
const ROUTE_RULES: ReadonlyArray<{ pattern: RegExp; allow: (identity: PanelIdentity) => boolean }> = [
  { pattern: /^\/admin\/tickets(?:\/|$)/, allow: (i) => isAdmin(i) || (hasRole(i, 'SUPPORT') && hasPermission(i, 'tickets.read')) },
  { pattern: /^\/admin\/teacher-prices(?:\/|$)/, allow: (i) => isAdmin(i) || (hasRole(i, 'FINANCE') && hasPermission(i, 'teacher-prices.manage')) },
  { pattern: /^\/admin\/payouts(?:\/|$)/, allow: (i) => isAdmin(i) || (hasRole(i, 'FINANCE') && hasPermission(i, 'payouts.manage')) },
  { pattern: /^\/admin\/refunds(?:\/|$)/, allow: (i) => isAdmin(i) || (hasRole(i, 'FINANCE') && hasPermission(i, 'payments.refund')) },
  { pattern: /^\/admin\/test-reviews(?:\/|$)/, allow: (i) => isAdmin(i) || hasRole(i, 'EXAMINER') },
  { pattern: /^\/admin(?:\/|$)/, allow: isAdmin },
  { pattern: /^\/teacher-panel(?:\/|$)/, allow: (i) => hasRole(i, 'TEACHER', 'ADMIN') },
  // Signed-in areas with no role requirement beyond having an account.
  { pattern: /^\/(?:dashboard|panel|checkout|matching|placement|teacher-apply|teachers)(?:\/|$)/, allow: () => true },
  { pattern: /^\/payment\/(?:success|failure|pending|development)(?:\/|$)/, allow: () => true },
  { pattern: /^\/test\/(?:device-check|session)(?:\/|$)/, allow: () => true },
  { pattern: /^\/$/, allow: () => true },
];

/**
 * Normalizes a caller-supplied redirect target (`?next=`) into a same-origin
 * path, or null when it cannot be trusted. Returning null must be treated as
 * "redirect to the panel home instead", never as "navigate anyway".
 */
export function safeInternalPath(value: string | null | undefined): string | null {
  if (!value) return null;
  // `//evil.com` and `/\evil.com` are protocol-relative URLs — a plain
  // `startsWith('/')` check passes them and the browser navigates off-site.
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null;
  // Control characters can smuggle a second URL past downstream parsers.
  if (/[\u0000-\u001f\u007f]/.test(value)) return null;
  let parsed: URL;
  try {
    // Resolving against a placeholder both rejects absolute URLs (their origin
    // differs) and normalizes `..` segments, so `/dashboard/../admin` is matched
    // against the rules as `/admin` rather than sneaking past the prefix checks.
    parsed = new URL(value, 'https://internal.invalid');
  } catch {
    return null;
  }
  if (parsed.origin !== 'https://internal.invalid') return null;
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

export function canOpenRequestedPanel(path: string, identity: PanelIdentity) {
  const normalized = safeInternalPath(path);
  if (!normalized) return false;
  // `/en/...` is the English rewrite of the same route; match on the bare path.
  const route = (normalized.split(/[?#]/)[0] ?? '').replace(/^\/en(?=\/|$)/, '') || '/';
  return ROUTE_RULES.find((rule) => rule.pattern.test(route))?.allow(identity) ?? false;
}
