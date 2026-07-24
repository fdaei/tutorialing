import { canOpenRequestedPanel, panelHome } from './panel-access';

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
});
