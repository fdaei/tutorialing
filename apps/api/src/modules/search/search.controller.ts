import { Controller, Get, Param, Query } from '@nestjs/common';
import { SearchService } from './search.service';
@Controller('search')
export class SearchController { constructor(private s:SearchService){} @Get(':entity') search(@Param('entity')entity:any,@Query('q')q='',@Query('page')page='1',@Query('pageSize')pageSize='20'){return this.s.search(entity,q,Number(page)||1,Number(pageSize)||20);} }
