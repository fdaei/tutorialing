import { Controller, Get, Param, Query } from '@nestjs/common';
import { RateLimit, RATE_LIMIT_TIERS, Roles } from '../../common';
import { SearchService, type SearchEntity } from './search.service';
// This is an internal lookup/autocomplete tool for staff panels (entities
// include `roles`, `support-agents`, raw `payments`/`bookings` rows) -- not
// something a STUDENT/TEACHER account should be able to reach at all. Before
// this it had no role scoping, only "is logged in" (RATE-005), so any
// authenticated user could scrape users/payments/bookings/support-agents.
@Roles('ADMIN', 'STAFF', 'FINANCE', 'SUPPORT', 'EXAMINER')
@RateLimit(RATE_LIMIT_TIERS.search)
@Controller('search')
export class SearchController {
  constructor(private s: SearchService) {}
  @Get(':entity') search(
    @Param('entity') entity: SearchEntity,
    @Query('q') q = '',
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ) {
    return this.s.search(entity, q, Number(page) || 1, Number(pageSize) || 20);
  }
}
