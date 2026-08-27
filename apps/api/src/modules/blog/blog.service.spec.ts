import { BlogService, BLOG_POST_TRANSITIONS } from './blog.service';
import type { CreateBlogPostDto, UpdateBlogPostDto } from './dto/request/blog-post.dto';

/**
 * SEC-213. The blog write path took `any` bodies and spread them onto Prisma,
 * so `status`, `authorId`, and nested relation writes were all client-settable
 * — a STAFF account could publish by sending a field, and set the byline to
 * someone else while doing it. These pin the two properties that replaced it:
 * the mapping names every column it writes, and `status` moves only through
 * the transition table.
 */

const VALID_POST: CreateBlogPostDto = {
  slug: 'hello-world',
  titleFa: 'سلام',
  titleEn: 'Hello',
  excerptFa: 'خلاصه',
  excerptEn: 'Excerpt',
  contentFa: 'متن',
  contentEn: 'Body',
};

function harness(post?: Record<string, unknown>) {
  const db = {
    blogPost: {
      create: jest.fn(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 'post-1', ...data })),
      update: jest.fn(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 'post-1', ...data })),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUnique: jest.fn().mockResolvedValue(post ?? null),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'post-1', ...post }),
      findFirst: jest.fn().mockResolvedValue(post?.status === 'PUBLISHED' ? { id: 'post-1' } : null),
    },
    blogRating: { upsert: jest.fn().mockResolvedValue({}), aggregate: jest.fn() },
    blogReaction: { upsert: jest.fn().mockResolvedValue({}) },
    blogView: { upsert: jest.fn().mockResolvedValue({}) },
    blogComment: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const audit = { write: jest.fn().mockResolvedValue({}) };
  const svc = new BlogService(db as never, audit as never);
  return { svc, db, audit };
}

const DRAFT = { id: 'post-1', slug: 'hello-world', titleFa: 'سلام', titleEn: 'Hello', status: 'DRAFT', publishedAt: null };
const PUBLISHED = { ...DRAFT, status: 'PUBLISHED', publishedAt: new Date('2026-01-01T00:00:00Z') };

describe('BlogService write mapping (SEC-213)', () => {
  it('creates only the columns it names, forcing DRAFT and the caller as author', async () => {
    const { svc, db } = harness();
    // Everything after `contentEn` is what an attacker would add to the body.
    await svc.create('editor-1', {
      ...VALID_POST,
      status: 'PUBLISHED',
      authorId: 'someone-else',
      publishedAt: new Date(),
      views: { create: [{ visitorKey: 'x' }] },
    } as unknown as CreateBlogPostDto);

    const { data } = db.blogPost.create.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(data.status).toBe('DRAFT');
    expect(data.author).toEqual({ connect: { id: 'editor-1' } });
    expect(data).not.toHaveProperty('authorId');
    expect(data).not.toHaveProperty('publishedAt');
    expect(data).not.toHaveProperty('views');
  });

  it('connects category and tags by id rather than accepting a nested relation write', async () => {
    const { svc, db } = harness();
    await svc.create('editor-1', { ...VALID_POST, categoryId: 'cat-1', tagIds: ['tag-1', 'tag-2'] });
    const { data } = db.blogPost.create.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(data.category).toEqual({ connect: { id: 'cat-1' } });
    expect(data.tags).toEqual({ connect: [{ id: 'tag-1' }, { id: 'tag-2' }] });
  });

  it('never lets an update body reach status, authorId, or an internal relation', async () => {
    const { svc, db } = harness(DRAFT);
    await svc.update('editor-1', 'post-1', {
      titleFa: 'عنوان تازه',
      status: 'PUBLISHED',
      authorId: 'someone-else',
      publishedAt: new Date(),
      views: { deleteMany: {} },
      ratings: { deleteMany: {} },
    } as unknown as UpdateBlogPostDto);

    const { data } = db.blogPost.update.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(data).toEqual({ titleFa: 'عنوان تازه' });
  });

  it('leaves untouched fields out of the update entirely', async () => {
    const { svc, db } = harness(DRAFT);
    await svc.update('editor-1', 'post-1', { coverImage: 'https://cdn/x.png' });
    const { data } = db.blogPost.update.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(Object.keys(data)).toEqual(['coverImage']);
  });

  it('404s instead of creating a row when the post does not exist', async () => {
    const { svc } = harness();
    await expect(svc.update('editor-1', 'missing', { titleFa: 'x' })).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'BLOG_POST_NOT_FOUND' }),
    });
  });
});

describe('BlogService status transitions (SEC-213)', () => {
  it('declares archive as terminal and draft as the only entry point', () => {
    expect(BLOG_POST_TRANSITIONS).toEqual({
      DRAFT: ['PUBLISHED', 'ARCHIVED'],
      PUBLISHED: ['ARCHIVED'],
      ARCHIVED: [],
    });
  });

  it('publishes a draft and stamps publishedAt', async () => {
    const { svc, db } = harness(DRAFT);
    await svc.transition('editor-1', 'post-1', 'PUBLISHED');
    const { where, data } = db.blogPost.updateMany.mock.calls[0]![0] as {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    };
    // Guarded on the status the decision was made against.
    expect(where).toEqual({ id: 'post-1', status: 'DRAFT' });
    expect(data.status).toBe('PUBLISHED');
    expect(data.publishedAt).toBeInstanceOf(Date);
  });

  it('does not re-stamp publishedAt on a post that already has one', async () => {
    const { svc, db } = harness(PUBLISHED);
    await svc.transition('editor-1', 'post-1', 'ARCHIVED');
    const { data } = db.blogPost.updateMany.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(data).not.toHaveProperty('publishedAt');
  });

  it.each([
    ['PUBLISHED', 'PUBLISHED', PUBLISHED],
    ['ARCHIVED', 'PUBLISHED', { ...DRAFT, status: 'ARCHIVED' }],
    ['ARCHIVED', 'ARCHIVED', { ...DRAFT, status: 'ARCHIVED' }],
  ] as const)('refuses %s -> %s', async (_from, target, post) => {
    const { svc, db } = harness(post);
    await expect(svc.transition('editor-1', 'post-1', target)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'BLOG_POST_TRANSITION_INVALID' }),
    });
    expect(db.blogPost.updateMany).not.toHaveBeenCalled();
  });

  it('refuses the transition when another editor moved the post first', async () => {
    const { svc, db } = harness(DRAFT);
    db.blogPost.updateMany.mockResolvedValue({ count: 0 });
    await expect(svc.transition('editor-1', 'post-1', 'PUBLISHED')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'BLOG_POST_TRANSITION_INVALID' }),
    });
  });
});

describe('BlogService audit trail (SEC-213)', () => {
  it('records create, update, publish and archive against the acting editor', async () => {
    const created = harness();
    await created.svc.create('editor-1', VALID_POST);
    expect(created.audit.write).toHaveBeenCalledWith(
      'editor-1', 'blog.post.created', 'BlogPost', 'post-1', undefined, expect.objectContaining({ status: 'DRAFT' }),
    );

    const updated = harness(DRAFT);
    await updated.svc.update('editor-2', 'post-1', { titleFa: 'x' });
    expect(updated.audit.write).toHaveBeenCalledWith(
      'editor-2', 'blog.post.updated', 'BlogPost', 'post-1', expect.any(Object), { fields: ['titleFa'] },
    );

    const published = harness(DRAFT);
    await published.svc.transition('editor-3', 'post-1', 'PUBLISHED');
    expect(published.audit.write).toHaveBeenCalledWith(
      'editor-3', 'blog.post.published', 'BlogPost', 'post-1', { status: 'DRAFT' }, { status: 'PUBLISHED' },
    );

    const archived = harness(PUBLISHED);
    await archived.svc.transition('editor-4', 'post-1', 'ARCHIVED');
    expect(archived.audit.write).toHaveBeenCalledWith(
      'editor-4', 'blog.post.archived', 'BlogPost', 'post-1', { status: 'PUBLISHED' }, { status: 'ARCHIVED' },
    );
  });
});

describe('BlogService reader writes (SEC-213)', () => {
  it.each(['react', 'rate', 'view'] as const)('refuses %s against an unpublished post', async (method) => {
    const { svc, db } = harness(DRAFT);
    const call = {
      react: () => svc.react('post-1', 'user-1', 'LIKE'),
      rate: () => svc.rate('post-1', 'user-1', 5),
      view: () => svc.view('post-1', 'visitor-key-1'),
    }[method];
    await expect(call()).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'BLOG_POST_NOT_FOUND' }),
    });
    expect(db.blogReaction.upsert).not.toHaveBeenCalled();
    expect(db.blogRating.upsert).not.toHaveBeenCalled();
    expect(db.blogView.upsert).not.toHaveBeenCalled();
  });

  it('scopes a reaction to the caller by the post/user unique key', async () => {
    const { svc, db } = harness(PUBLISHED);
    await svc.react('post-1', 'user-1', 'LIKE');
    expect(db.blogReaction.upsert).toHaveBeenCalledWith({
      where: { postId_userId: { postId: 'post-1', userId: 'user-1' } },
      create: { postId: 'post-1', userId: 'user-1', type: 'LIKE' },
      update: { type: 'LIKE' },
    });
  });

  it('returns an aggregate rating rather than every rater on the public detail route', async () => {
    const { svc, db } = harness(PUBLISHED);
    db.blogPost.findFirst.mockResolvedValue({ id: 'post-1', slug: 'hello-world', status: 'PUBLISHED' });
    db.blogRating.aggregate.mockResolvedValue({ _avg: { value: 4.5 }, _count: { value: 2 } });
    const detail = await svc.detail('hello-world');
    expect(detail.rating).toEqual({ average: 4.5, count: 2 });
    expect(detail).not.toHaveProperty('ratings');
    const include = (db.blogPost.findFirst.mock.calls[0]![0] as { include: Record<string, unknown> }).include;
    expect(include).not.toHaveProperty('ratings');
  });
});
