import { Controller, Get, Param, Query } from '@nestjs/common';
import { CurrentUser, RateLimit, RATE_LIMIT_TIERS, Roles, type AuthUser } from '../../common';
import { SearchService } from './search.service';
import { assertMaySearch } from './search-access.policy';
// This is an internal lookup/autocomplete tool for staff panels (entities
// include `roles`, `support-agents`, raw `payments`/`bookings` rows) -- not
// something a STUDENT/TEACHER account should be able to reach at all. Before
// this it had no role scoping, only "is logged in" (RATE-005), so any
// authenticated user could scrape users/payments/bookings/support-agents.
// `@Roles` only establishes staff-tier; `assertMaySearch` below is what
// scopes which entity a given staff-tier account may actually read (SEC-208).
@Roles('ADMIN', 'STAFF', 'FINANCE', 'SUPPORT', 'EXAMINER')
@RateLimit(RATE_LIMIT_TIERS.search)
@Controller('search')
export class SearchController {
  constructor(private s: SearchService) {}
  @Get(':entity') search(
    @CurrentUser() user: AuthUser,
    @Param('entity') entity: string,
    @Query('q') q = '',
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ) {
    assertMaySearch(user.permissions, entity);
    return this.s.search(entity, q, Number(page) || 1, Number(pageSize) || 20);
  }
}
