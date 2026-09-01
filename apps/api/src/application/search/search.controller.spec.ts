import { SearchController } from './search.controller';
import type { AuthUser } from '../../common';
import type { SearchService } from './search.service';

/**
 * SEC-208. Fixtures are shaped like what each role *should* hold under
 * least privilege, independent of the current seed data (which still grants
 * every permission to every staff-tier seed account — see
 * AUDIT/SEC-208-design.md "Backward compatibility considerations"). These
 * tests pin the authorization mechanism, not today's seed contents.
 */
const user = (roles: string[], permissions: string[]): AuthUser => ({
  id: 'user-1',
  sessionId: 'session-1',
  roles,
  permissions,
});

const SUPPORT = user(['SUPPORT'], ['tickets.read', 'tickets.manage', 'notifications.read']);
const EXAMINER = user(['SUPPORT'], ['tests.manage']);
const FINANCE = user(['SUPPORT'], ['payments.read', 'payments.refund', 'payouts.manage']);
const ADMIN = user(
  ['ADMIN'],
  [
    'users.read',
    'teachers.read',
    'tests.manage',
    'bookings.read',
    'payments.read',
    'roles.manage',
    'languages.manage',
    'tickets.manage',
  ],
);

function controller() {
  const searched = jest
    .fn()
    .mockResolvedValue({ items: [], pagination: { page: 1, pageSize: 20, total: 0, pages: 0, hasMore: false } });
  const service = { search: searched } as unknown as SearchService;
  return { ctrl: new SearchController(service), searched };
}

/** `toThrow` only matches on `.message`; DomainException's code lives in
 * `.response.code`, so assert on the caught error directly. */
function thrownBy(fn: () => unknown): unknown {
  try {
    fn();
    return undefined;
  } catch (error) {
    return error;
  }
}

describe('SearchController entity permission scoping (SEC-208)', () => {
  it('1. SUPPORT cannot search payments', () => {
    const { ctrl, searched } = controller();
    expect(thrownBy(() => ctrl.search(SUPPORT, 'payments', '', '1', '20'))).toMatchObject({
      response: { code: 'SEARCH_PERMISSION_REQUIRED' },
    });
    expect(searched).not.toHaveBeenCalled();
  });

  it('2. EXAMINER cannot search payments', () => {
    const { ctrl, searched } = controller();
    expect(thrownBy(() => ctrl.search(EXAMINER, 'payments', '', '1', '20'))).toMatchObject({
      response: { code: 'SEARCH_PERMISSION_REQUIRED' },
    });
    expect(searched).not.toHaveBeenCalled();
  });

  it('3. SUPPORT cannot search roles', () => {
    const { ctrl, searched } = controller();
    expect(thrownBy(() => ctrl.search(SUPPORT, 'roles', '', '1', '20'))).toMatchObject({
      response: { code: 'SEARCH_PERMISSION_REQUIRED' },
    });
    expect(searched).not.toHaveBeenCalled();
  });

  it('4. FINANCE can search payments if the permission exists', () => {
    const { ctrl, searched } = controller();
    ctrl.search(FINANCE, 'payments', 'x', '1', '20');
    expect(searched).toHaveBeenCalledWith('payments', 'x', 1, 20);
  });

  it('5. ADMIN can access allowed entities', () => {
    const { ctrl, searched } = controller();
    for (const entity of [
      'users',
      'teachers',
      'tests',
      'bookings',
      'payments',
      'roles',
      'languages',
      'support-agents',
    ]) {
      ctrl.search(ADMIN, entity, '', '1', '20');
    }
    expect(searched).toHaveBeenCalledTimes(8);
  });

  it('SUPPORT can still search its own entity (support-agents) — role gate is not the only thing that changed', () => {
    const { ctrl, searched } = controller();
    ctrl.search(SUPPORT, 'support-agents', '', '1', '20');
    expect(searched).toHaveBeenCalledWith('support-agents', '', 1, 20);
  });

  it('rejects an unknown entity for every fixture, including ADMIN', () => {
    const { ctrl } = controller();
    for (const u of [SUPPORT, EXAMINER, FINANCE, ADMIN]) {
      expect(thrownBy(() => ctrl.search(u, 'not-a-real-entity', '', '1', '20'))).toMatchObject({
        response: { code: 'SEARCH_ENTITY_INVALID' },
      });
    }
  });
});
