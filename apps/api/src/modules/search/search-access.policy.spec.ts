import { assertMaySearch, SEARCH_ENTITY_PERMISSIONS } from './search-access.policy';

/** `toThrow` only matches on `.message`; DomainException's code lives in
 * `.response.code`, so assert on the caught error directly (same pattern
 * `admin.service.spec.ts` uses via `.rejects.toMatchObject`, adapted for a
 * synchronous throw). */
function thrownBy(fn: () => unknown): unknown {
  try {
    fn();
    return undefined;
  } catch (error) {
    return error;
  }
}

describe('assertMaySearch', () => {
  it('rejects an unknown entity with SEARCH_ENTITY_INVALID, before any permission check', () => {
    expect(thrownBy(() => assertMaySearch(['payments.read', 'roles.manage'], 'not-a-real-entity'))).toMatchObject({
      response: { code: 'SEARCH_ENTITY_INVALID' },
    });
  });

  it.each(Object.entries(SEARCH_ENTITY_PERMISSIONS))(
    'rejects %s with SEARCH_PERMISSION_REQUIRED when the caller lacks %s',
    (entity, permission) => {
      const unrelatedPermissions = ['some.other.permission'];
      expect(unrelatedPermissions).not.toContain(permission);
      expect(thrownBy(() => assertMaySearch(unrelatedPermissions, entity))).toMatchObject({
        response: { code: 'SEARCH_PERMISSION_REQUIRED' },
      });
    },
  );

  it.each(Object.entries(SEARCH_ENTITY_PERMISSIONS))('allows %s when the caller holds %s', (entity, permission) => {
    expect(() => assertMaySearch([permission], entity)).not.toThrow();
  });

  it('does not let holding one entity permission unlock a different entity', () => {
    // A SUPPORT-shaped permission set: ticket-related only.
    const supportPermissions = ['tickets.read', 'tickets.manage', 'notifications.read'];
    expect(() => assertMaySearch(supportPermissions, 'support-agents')).not.toThrow();
    expect(thrownBy(() => assertMaySearch(supportPermissions, 'payments'))).toMatchObject({
      response: { code: 'SEARCH_PERMISSION_REQUIRED' },
    });
    expect(thrownBy(() => assertMaySearch(supportPermissions, 'roles'))).toMatchObject({
      response: { code: 'SEARCH_PERMISSION_REQUIRED' },
    });
  });
});
