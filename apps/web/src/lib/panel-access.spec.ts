import { canOpenRequestedPanel, panelHome, safeInternalPath } from './panel-access';

describe('panel access routing', () => {
  it('sends support users directly to their ticket workspace', () => {
    const user = { roles: ['SUPPORT'], permissions: ['tickets.read', 'tickets.manage'] };
    expect(panelHome(user)).toBe('/admin/tickets');
    expect(canOpenRequestedPanel('/admin/tickets', user)).toBe(true);
    expect(canOpenRequestedPanel('/admin', user)).toBe(false);
    expect(canOpenRequestedPanel('/admin/users', user)).toBe(false);
  });

  it('routes examiner and finance roles to an authorized section', () => {
    expect(panelHome({ roles: ['EXAMINER'], permissions: ['tests.review'] })).toBe('/admin/test-reviews');
    expect(panelHome({ roles: ['FINANCE'], permissions: ['payouts.manage'] })).toBe('/admin/payouts');
  });

  it('requires the matching permission for each finance section', () => {
    const payoutsOnly = { roles: ['FINANCE'], permissions: ['payouts.manage'] };
    expect(canOpenRequestedPanel('/admin/payouts', payoutsOnly)).toBe(true);
    expect(canOpenRequestedPanel('/admin/refunds', payoutsOnly)).toBe(false);
    expect(canOpenRequestedPanel('/admin/teacher-prices', payoutsOnly)).toBe(false);
  });

  it('denies unknown routes instead of falling through to allow', () => {
    const admin = { roles: ['ADMIN'], permissions: [] };
    const student = { roles: ['STUDENT'], permissions: [] };
    // A route nobody has listed must not become reachable by default.
    expect(canOpenRequestedPanel('/some-cms-page', admin)).toBe(false);
    expect(canOpenRequestedPanel('/internal/debug', admin)).toBe(false);
    // A prefix that merely starts with an allowed segment is not that segment.
    expect(canOpenRequestedPanel('/admin-backdoor', admin)).toBe(false);
    expect(canOpenRequestedPanel('/teacher-panel-x', student)).toBe(false);
  });

  it('resolves traversal against the rules rather than the literal prefix', () => {
    const student = { roles: ['STUDENT'], permissions: [] };
    expect(canOpenRequestedPanel('/dashboard/../admin', student)).toBe(false);
    expect(canOpenRequestedPanel('/dashboard/../admin', { roles: ['ADMIN'], permissions: [] })).toBe(true);
  });

  it('matches the English rewrite of a route the same way', () => {
    const teacher = { roles: ['TEACHER'], permissions: [] };
    expect(canOpenRequestedPanel('/en/teacher-panel', teacher)).toBe(true);
    expect(canOpenRequestedPanel('/en/admin', teacher)).toBe(false);
  });
});

describe('safeInternalPath', () => {
  it('accepts same-origin paths and keeps their query and hash', () => {
    expect(safeInternalPath('/dashboard')).toBe('/dashboard');
    expect(safeInternalPath('/checkout?plan=1#top')).toBe('/checkout?plan=1#top');
  });

  it('rejects off-site targets that a startsWith("/") check would pass', () => {
    expect(safeInternalPath('//evil.com')).toBeNull();
    expect(safeInternalPath('/\\evil.com')).toBeNull();
    expect(safeInternalPath('https://evil.com')).toBeNull();
    expect(safeInternalPath('javascript:alert(1)')).toBeNull();
    expect(safeInternalPath('/admin\nSet-Cookie: x=1')).toBeNull();
    expect(safeInternalPath('')).toBeNull();
    expect(safeInternalPath(null)).toBeNull();
  });

  it('never lets a rejected target through canOpenRequestedPanel', () => {
    expect(canOpenRequestedPanel('//evil.com', { roles: ['ADMIN'], permissions: [] })).toBe(false);
  });
});
