import { badRequest, forbidden } from '../../common';
import type { SearchEntity } from './search.service';

/**
 * Entity -> permission mapping for `GET /search/:entity`. Every value here
 * already gates an equivalent `/admin/*` (or `/support/*`) read/write
 * endpoint — see ROLE_MANAGEMENT_POLICY.md's neighbour, AUDIT/SEC-208-design.md,
 * for the reasoning behind each choice.
 *
 * `@Roles('ADMIN','ADMIN','SUPPORT','SUPPORT','SUPPORT')` on the controller
 * only established that the caller is staff-tier; it never implied they may
 * read every entity. This map is what does that (SEC-208).
 */
export const SEARCH_ENTITY_PERMISSIONS: Record<SearchEntity, string> = {
  users: 'users.read',
  teachers: 'teachers.read',
  tests: 'tests.manage',
  passages: 'tests.manage',
  bookings: 'bookings.read',
  payments: 'payments.read',
  roles: 'roles.manage',
  languages: 'languages.manage',
  'support-agents': 'tickets.manage',
};

/**
 * Throws unless `permissions` includes the entity's required permission.
 *
 * Unknown entities fail closed with the same `SEARCH_ENTITY_INVALID` code
 * `SearchService`'s switch default already used — raised here instead, one
 * layer earlier, so an unrecognised entity is rejected before any permission
 * (or query) logic ever runs against it.
 */
export function assertMaySearch(permissions: readonly string[], entity: string): asserts entity is SearchEntity {
  const required = (SEARCH_ENTITY_PERMISSIONS as Record<string, string | undefined>)[entity];
  if (!required) throw badRequest('SEARCH_ENTITY_INVALID');
  if (!permissions.includes(required)) throw forbidden('SEARCH_PERMISSION_REQUIRED');
}
