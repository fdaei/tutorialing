import { Injectable } from '@nestjs/common';
import { BlogPostStatus, BlogReactionType, Prisma } from '@prisma/client';
import { conflict, notFound } from '../../common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuditService } from '../../system/audit/audit.service';
import { CreateBlogPostDto, ListBlogPostsDto, UpdateBlogPostDto } from './dto/request/blog-post.dto';

/**
 * The lifecycle a post is allowed to walk, named rather than implied.
 *
 * A post is created as a DRAFT and can only become PUBLISHED or ARCHIVED
 * through `transition`, never through an update body. ARCHIVED is terminal:
 * archiving is the module's delete, and un-deleting is a product decision
 * nobody has taken.
 */
export const BLOG_POST_TRANSITIONS: Readonly<Record<BlogPostStatus, readonly BlogPostStatus[]>> = {
  DRAFT: ['PENDING_REVIEW', 'ARCHIVED'],
  PENDING_REVIEW: ['APPROVED', 'REJECTED'],
  APPROVED: ['PUBLISHED', 'REJECTED'],
  REJECTED: ['PENDING_REVIEW', 'ARCHIVED'],
  PUBLISHED: ['ARCHIVED'],
  ARCHIVED: [],
};

const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 50;

const AUTHOR = { select: { id: true, name: true, avatarKey: true } } as const;

@Injectable()
export class BlogService {
  constructor(
    private readonly db: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(query: ListBlogPostsDto) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const where: Prisma.BlogPostWhereInput = { status: 'PUBLISHED' };
    if (query.category) where.category = { slug: query.category };
    if (query.search) {
      where.OR = [
        { titleFa: { contains: query.search, mode: 'insensitive' } },
        { titleEn: { contains: query.search, mode: 'insensitive' } },
        { excerptFa: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    return this.db.blogPost
      .findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { publishedAt: 'desc' },
        include: { category: true, tags: true, author: AUTHOR, _count: { select: { views: true } } },
      })
      .then((items) => ({ items, page, pageSize }));
  }

  /**
   * Ratings used to come back as raw rows, which put the user id of every
   * person who had rated a post on an unauthenticated endpoint. The reader only
   * ever needs the aggregate.
   */
  async detail(slug: string) {
    const post = await this.db.blogPost.findFirst({
      where: { slug, status: 'PUBLISHED' },
      include: {
        category: true,
        tags: true,
        author: AUTHOR,
        images: true,
        _count: { select: { views: true, comments: true } },
      },
    });
    if (!post) throw notFound('BLOG_POST_NOT_FOUND');
    const ratings = await this.db.blogRating.aggregate({
      where: { postId: post.id },
      _avg: { value: true },
      _count: { value: true },
    });
    return { ...post, rating: { average: ratings._avg.value, count: ratings._count.value } };
  }

  comments(postId: string) {
    return this.db.blogComment.findMany({
      where: { postId, status: 'APPROVED', parentId: null },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { id: true, name: true, avatarKey: true } }, replies: { where: { status: 'APPROVED' }, orderBy: { createdAt: 'asc' }, include: { user: { select: { id: true, name: true, avatarKey: true } } } } },
    });
  }

  async comment(postId: string, userId: string, body: string, parentId?: string) {
    await this.assertPublished(postId);
    if (parentId) {
      const parent = await this.db.blogComment.findFirst({ where: { id: parentId, postId, status: 'APPROVED' }, select: { id: true, parentId: true } });
      if (!parent) throw notFound('BLOG_PARENT_COMMENT_NOT_FOUND');
      if (parent.parentId) throw conflict('BLOG_COMMENT_REPLY_DEPTH_EXCEEDED');
    }
    return this.db.blogComment.create({ data: { postId, userId, parentId, body: body.trim(), status: 'PENDING' }, include: { user: { select: { id: true, name: true, avatarKey: true } } } });
  }

  moderateComment(id: string, status: 'APPROVED' | 'REJECTED') {
    return this.db.blogComment.update({ where: { id }, data: { status } });
  }

  mine(authorId: string) {
    return this.db.blogPost.findMany({
      where: { authorId },
      include: { category: true, tags: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  reviewQueue() {
    return this.db.blogPost.findMany({
      where: { status: 'PENDING_REVIEW' },
      include: { category: true, tags: true, author: AUTHOR },
      orderBy: { submittedAt: 'asc' },
    });
  }

  /**
   * Every column is named. The previous implementation spread the request body
   * straight onto `blogPost.create`, so anything the caller put in the body —
   * `status`, `authorId`, a nested relation write — went to the database.
   * Authorship comes from the access token, and a new post is always a DRAFT.
   */
  async create(actorId: string, dto: CreateBlogPostDto) {
    const post = await this.db.blogPost.create({
      data: {
        slug: dto.slug,
        titleFa: dto.titleFa,
        titleEn: dto.titleEn,
        excerptFa: dto.excerptFa,
        excerptEn: dto.excerptEn,
        contentFa: dto.contentFa,
        contentEn: dto.contentEn,
        coverImage: dto.coverImage,
        seoTitleFa: dto.seoTitleFa,
        seoTitleEn: dto.seoTitleEn,
        seoDescriptionFa: dto.seoDescriptionFa,
        seoDescriptionEn: dto.seoDescriptionEn,
        status: 'DRAFT',
        author: { connect: { id: actorId } },
        ...(dto.categoryId ? { category: { connect: { id: dto.categoryId } } } : {}),
        ...(dto.tagIds?.length ? { tags: { connect: dto.tagIds.map((id) => ({ id })) } } : {}),
      },
    });
    await this.audit.write(actorId, 'blog.post.created', 'BlogPost', post.id, undefined, {
      slug: post.slug,
      status: post.status,
    });
    return post;
  }

  /** Same field-by-field mapping as `create`, and the same fields — no more. */
  async update(actorId: string, id: string, dto: UpdateBlogPostDto, canManageAll = true) {
    const before = await this.db.blogPost.findUnique({ where: { id } });
    if (!before) throw notFound('BLOG_POST_NOT_FOUND');
    if (!canManageAll && before.authorId !== actorId) throw notFound('BLOG_POST_NOT_FOUND');
    if (!canManageAll && !['DRAFT', 'REJECTED'].includes(before.status)) throw conflict('BLOG_POST_EDIT_NOT_ALLOWED');

    const data: Prisma.BlogPostUpdateInput = {};
    if (dto.slug !== undefined) data.slug = dto.slug;
    if (dto.titleFa !== undefined) data.titleFa = dto.titleFa;
    if (dto.titleEn !== undefined) data.titleEn = dto.titleEn;
    if (dto.excerptFa !== undefined) data.excerptFa = dto.excerptFa;
    if (dto.excerptEn !== undefined) data.excerptEn = dto.excerptEn;
    if (dto.contentFa !== undefined) data.contentFa = dto.contentFa;
    if (dto.contentEn !== undefined) data.contentEn = dto.contentEn;
    if (dto.coverImage !== undefined) data.coverImage = dto.coverImage;
    if (dto.seoTitleFa !== undefined) data.seoTitleFa = dto.seoTitleFa;
    if (dto.seoTitleEn !== undefined) data.seoTitleEn = dto.seoTitleEn;
    if (dto.seoDescriptionFa !== undefined) data.seoDescriptionFa = dto.seoDescriptionFa;
    if (dto.seoDescriptionEn !== undefined) data.seoDescriptionEn = dto.seoDescriptionEn;
    if (dto.categoryId !== undefined) data.category = { connect: { id: dto.categoryId } };
    if (dto.tagIds !== undefined) data.tags = { set: dto.tagIds.map((tagId) => ({ id: tagId })) };

    const post = await this.db.blogPost.update({ where: { id }, data });
    await this.audit.write(
      actorId,
      'blog.post.updated',
      'BlogPost',
      id,
      { slug: before.slug, titleFa: before.titleFa, titleEn: before.titleEn },
      { fields: Object.keys(data) },
    );
    return post;
  }

  /**
   * The only path that moves `status`. The update is guarded on the status the
   * decision was made against, so two editors publishing and archiving at once
   * cannot both win and leave the post in a state neither asked for.
   */
  async transition(actorId: string, id: string, target: BlogPostStatus) {
    const before = await this.db.blogPost.findUnique({ where: { id } });
    if (!before) throw notFound('BLOG_POST_NOT_FOUND');
    if (!BLOG_POST_TRANSITIONS[before.status].includes(target)) throw conflict('BLOG_POST_TRANSITION_INVALID');

    const claimed = await this.db.blogPost.updateMany({
      where: { id, status: before.status },
      data: {
        status: target,
        ...(target === 'PENDING_REVIEW' ? { submittedAt: new Date(), rejectionReason: null, reviewedAt: null, reviewedById: null } : {}),
        ...(['APPROVED', 'REJECTED'].includes(target) ? { reviewedAt: new Date(), reviewedById: actorId } : {}),
        // First publication stamps the date; re-publishing a post that already
        // has one must not backdate the archive of its original release.
        ...(target === 'PUBLISHED' && !before.publishedAt ? { publishedAt: new Date() } : {}),
      },
    });
    if (claimed.count !== 1) throw conflict('BLOG_POST_TRANSITION_INVALID');

    await this.audit.write(
      actorId,
      target === 'PUBLISHED' ? 'blog.post.published' : 'blog.post.archived',
      'BlogPost',
      id,
      { status: before.status },
      { status: target },
    );
    return this.db.blogPost.findUniqueOrThrow({ where: { id } });
  }

  async submit(authorId: string, id: string) {
    const post = await this.db.blogPost.findFirst({ where: { id, authorId } });
    if (!post) throw notFound('BLOG_POST_NOT_FOUND');
    return this.transition(authorId, id, 'PENDING_REVIEW');
  }

  approve(reviewerId: string, id: string) {
    return this.transition(reviewerId, id, 'APPROVED');
  }

  async reject(reviewerId: string, id: string, reason: string) {
    const before = await this.db.blogPost.findUnique({ where: { id } });
    if (!before) throw notFound('BLOG_POST_NOT_FOUND');
    if (!BLOG_POST_TRANSITIONS[before.status].includes('REJECTED')) throw conflict('BLOG_POST_TRANSITION_INVALID');
    const reviewedAt = new Date();
    const claimed = await this.db.blogPost.updateMany({
      where: { id, status: before.status },
      data: { status: 'REJECTED', rejectionReason: reason.trim(), reviewedAt, reviewedById: reviewerId },
    });
    if (claimed.count !== 1) throw conflict('BLOG_POST_TRANSITION_INVALID');
    await this.audit.write(reviewerId, 'blog.post.rejected', 'BlogPost', id, { status: before.status }, { status: 'REJECTED', reason: reason.trim() });
    return this.db.blogPost.findUniqueOrThrow({ where: { id } });
  }

  async react(postId: string, userId: string, type: BlogReactionType) {
    await this.assertPublished(postId);
    return this.db.blogReaction.upsert({
      where: { postId_userId: { postId, userId } },
      create: { postId, userId, type },
      update: { type },
    });
  }

  async rate(postId: string, userId: string, value: number) {
    await this.assertPublished(postId);
    return this.db.blogRating.upsert({
      where: { postId_userId: { postId, userId } },
      create: { postId, userId, value },
      update: { value },
    });
  }

  async view(postId: string, visitorKey: string) {
    await this.assertPublished(postId);
    return this.db.blogView.upsert({
      where: { postId_visitorKey: { postId, visitorKey } },
      create: { postId, visitorKey },
      update: {},
    });
  }

  /**
   * Reader writes address a post by id, which is guessable in a way the public
   * slug lookup is not. Without this, a reader could react to, rate, or inflate
   * the view count of a draft nobody has published — and confirm the id exists.
   */
  private async assertPublished(postId: string) {
    const post = await this.db.blogPost.findFirst({ where: { id: postId, status: 'PUBLISHED' }, select: { id: true } });
    if (!post) throw notFound('BLOG_POST_NOT_FOUND');
  }
}
