import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  Public,
  PublicRateLimit,
  RateLimit,
  RATE_LIMIT_TIERS,
  Roles,
  type AuthUser,
} from '../../common';
import { PermissionKeys, RequirePermissions } from '../auth/authorization';
import { BlogService } from './blog.service';
import { CreateBlogPostDto, ListBlogPostsDto, UpdateBlogPostDto } from './dto/request/blog-post.dto';
import { BlogRatingDto, BlogReactionDto, BlogViewDto } from './dto/request/blog-interaction.dto';

/**
 * Three tiers of access, each stated on the route rather than inferred:
 *
 *  - `@Public()` reads: the published blog, which is the point of having one.
 *  - Authenticated reader writes (reaction, rating): scoped to the caller by
 *    the `postId_userId` unique key, so there is nothing a role gate would add.
 *  - Editorial writes: ADMIN/STAFF *and* the `cms.manage` permission. The role
 *    alone used to be the whole check, which made every STAFF account a
 *    publisher regardless of what had actually been granted to it.
 */
@ApiTags('blog')
@Controller('blog')
export class BlogController {
  constructor(private readonly blog: BlogService) {}

  @Public() @Get('posts')
  list(@Query() query: ListBlogPostsDto) {
    return this.blog.list(query);
  }

  @Public() @Get('posts/:slug')
  detail(@Param('slug') slug: string) {
    return this.blog.detail(slug);
  }

  @Public() @Get('posts/:id/comments')
  comments(@Param('id') id: string) {
    return this.blog.comments(id);
  }

  @Roles('ADMIN', 'STAFF')
  @RequirePermissions(PermissionKeys.Content.Manage)
  @RateLimit(RATE_LIMIT_TIERS.adminWrite)
  @Post('posts')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateBlogPostDto) {
    return this.blog.create(user.id, dto);
  }

  @Roles('ADMIN', 'STAFF')
  @RequirePermissions(PermissionKeys.Content.Manage)
  @RateLimit(RATE_LIMIT_TIERS.adminWrite)
  @Patch('posts/:id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateBlogPostDto) {
    return this.blog.update(user.id, id, dto);
  }

  @Roles('ADMIN', 'STAFF')
  @RequirePermissions(PermissionKeys.Content.Manage)
  @RateLimit(RATE_LIMIT_TIERS.adminWrite)
  @Post('posts/:id/publish')
  publish(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.blog.transition(user.id, id, 'PUBLISHED');
  }

  /** Archive is this module's delete; nothing is removed from the database. */
  @Roles('ADMIN', 'STAFF')
  @RequirePermissions(PermissionKeys.Content.Manage)
  @RateLimit(RATE_LIMIT_TIERS.adminWrite)
  @Delete('posts/:id')
  archive(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.blog.transition(user.id, id, 'ARCHIVED');
  }

  @Post('posts/:id/reaction')
  react(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: BlogReactionDto) {
    return this.blog.react(id, user.id, dto.type);
  }

  @Post('posts/:id/rating')
  rate(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: BlogRatingDto) {
    return this.blog.rate(id, user.id, dto.value);
  }

  /**
   * The one unauthenticated write in the module: anyone can call it, so it is
   * throttled per IP and its only body field is a bounded, URL-safe key.
   */
  @PublicRateLimit(RATE_LIMIT_TIERS.publicRead)
  @Post('posts/:id/view')
  view(@Param('id') id: string, @Body() dto: BlogViewDto) {
    return this.blog.view(id, dto.visitorKey);
  }
}
