export type PanelIdentity = { roles?: string[]; permissions?: string[] };

export function panelHome(identity: PanelIdentity) {
  const roles = Array.isArray(identity.roles) ? identity.roles : [];
  const permissions = Array.isArray(identity.permissions) ? identity.permissions : [];
  if (roles.some((role) => ['ADMIN', 'STAFF'].includes(role))) return '/admin';
  if (roles.includes('SUPPORT') && permissions.includes('tickets.read')) return '/admin/tickets';
  if (roles.includes('FINANCE')) {
    if (permissions.includes('teacher-prices.manage')) return '/admin/teacher-prices';
    if (permissions.includes('payouts.manage')) return '/admin/payouts';
    if (permissions.includes('payments.refund')) return '/admin/refunds';
  }
  if (roles.includes('EXAMINER')) return '/admin/test-reviews';
  if (roles.includes('TEACHER')) return '/teacher-panel';
  return '/dashboard';
}

export function canOpenRequestedPanel(path: string, identity: PanelIdentity) {
  const roles = Array.isArray(identity.roles) ? identity.roles : [];
  const permissions = Array.isArray(identity.permissions) ? identity.permissions : [];
  if (path.startsWith('/en/')) path = path.slice(3);
  if (path === '/panel') return true;
  if (path.startsWith('/teacher-panel')) return roles.some((role) => ['TEACHER', 'ADMIN'].includes(role));
  if (path.startsWith('/dashboard')) return true;
  if (!path.startsWith('/admin')) return true;
  if (roles.some((role) => ['ADMIN', 'STAFF'].includes(role))) return true;
  if (roles.includes('SUPPORT')) return path.startsWith('/admin/tickets') && permissions.includes('tickets.read');
  if (roles.includes('FINANCE')) {
    if (path.startsWith('/admin/teacher-prices')) return permissions.includes('teacher-prices.manage');
    if (path.startsWith('/admin/payouts')) return permissions.includes('payouts.manage');
    if (path.startsWith('/admin/refunds')) return permissions.includes('payments.refund');
  }
  if (roles.includes('EXAMINER')) return path.startsWith('/admin/test-reviews');
  return false;
}
