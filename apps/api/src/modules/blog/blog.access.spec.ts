import { ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PUBLIC_KEY } from '../../common/http/constants/auth.constants';
import { RATE_LIMIT_KEY } from '../../common/http/decorators/rate-limit.decorator';
import { validationResponse } from '../../common/errors/domain.exception';
import { AuthorizationGuard } from '../auth/authorization/guards/authorization.guard';
import { BlogController } from './blog.controller';
import { CreateBlogPostDto, UpdateBlogPostDto } from './dto/request/blog-post.dto';
import { BlogViewDto } from './dto/request/blog-interaction.dto';

/**
 * SEC-213. The blog write routes carried `@Roles('ADMIN','ADMIN')` and nothing
 * else, so holding the STAFF role was the whole check — the `cms.manage`
 * permission that gates every other content write was never consulted. These
 * read the decorators actually on `BlogController` (via a real `Reflector`)
 * rather than restating them, so removing one fails the test.
 */

const EDITORIAL = ['create', 'update', 'publish', 'archive'] as const;
const READER_WRITES = ['react', 'rate'] as const;

const guard = new AuthorizationGuard(new Reflector());

function context(method: keyof BlogController, roles: string[], permissions: string[]) {
  return {
    getHandler: () => BlogController.prototype[method],
    getClass: () => BlogController,
    switchToHttp: () => ({ getRequest: () => ({ user: { id: 'u1', roles, permissions } }) }),
  } as never;
}

describe('blog editorial authorization (SEC-213)', () => {
  it.each(EDITORIAL)('allows STAFF holding cms.manage to %s', (method) => {
    expect(guard.canActivate(context(method, ['ADMIN'], ['cms.manage']))).toBe(true);
  });

  it.each(EDITORIAL)('denies STAFF without cms.manage on %s', (method) => {
    expect(() => guard.canActivate(context(method, ['ADMIN'], []))).toThrow(
      expect.objectContaining({ response: expect.objectContaining({ code: 'PERMISSION_NOT_GRANTED' }) }),
    );
  });

  it.each(EDITORIAL)('denies a signed-in student on %s', (method) => {
    expect(() => guard.canActivate(context(method, ['STUDENT'], ['cms.manage']))).toThrow(
      expect.objectContaining({ response: expect.objectContaining({ code: 'ROLE_NOT_PERMITTED' }) }),
    );
  });

  it.each(EDITORIAL)('does not expose %s publicly', (method) => {
    expect(new Reflector().get(PUBLIC_KEY, BlogController.prototype[method])).toBeUndefined();
  });

  it.each(READER_WRITES)('leaves %s authenticated but ungated, scoped by the caller id', (method) => {
    expect(new Reflector().get(PUBLIC_KEY, BlogController.prototype[method])).toBeUndefined();
    // No role gate: the service keys the row on the caller, so there is no
    // second user's data to reach.
    expect(guard.canActivate(context(method, ['STUDENT'], []))).toBe(true);
  });

  it('throttles the one unauthenticated write route', () => {
    const reflector = new Reflector();
    expect(reflector.get(PUBLIC_KEY, BlogController.prototype.view)).toBe(true);
    expect(reflector.get(RATE_LIMIT_KEY, BlogController.prototype.view)).toEqual(
      expect.objectContaining({ limit: expect.any(Number), windowSeconds: expect.any(Number) }),
    );
  });
});

/**
 * The same pipe `main.ts` installs. `forbidNonWhitelisted` is what turns an
 * unexpected field into a 400 instead of a silent strip, so a body carrying
 * `status` or `authorId` is refused at the edge as well as ignored by the
 * service mapping.
 */
const pipe = new ValidationPipe({
  whitelist: true,
  transform: true,
  forbidNonWhitelisted: true,
  exceptionFactory: validationResponse,
});

const VALID_POST = {
  slug: 'hello-world',
  titleFa: 'سلام',
  titleEn: 'Hello',
  excerptFa: 'خلاصه',
  excerptEn: 'Excerpt',
  contentFa: 'متن',
  contentEn: 'Body',
};

const validate = (body: unknown, metatype: unknown) =>
  pipe.transform(body, { type: 'body', metatype: metatype as never });

describe('blog request validation (SEC-213)', () => {
  it('accepts a well-formed create body', async () => {
    await expect(validate(VALID_POST, CreateBlogPostDto)).resolves.toMatchObject({ slug: 'hello-world' });
  });

  it.each(['status', 'authorId', 'publishedAt', 'views', 'ratings'])(
    'rejects a create body carrying %s',
    async (field) => {
      await expect(validate({ ...VALID_POST, [field]: 'PUBLISHED' }, CreateBlogPostDto)).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'VALIDATION_ERROR' }),
      });
    },
  );

  it.each(['status', 'authorId', 'publishedAt', 'views', 'ratings'])(
    'rejects an update body carrying %s',
    async (field) => {
      await expect(validate({ titleFa: 'x', [field]: 'PUBLISHED' }, UpdateBlogPostDto)).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'VALIDATION_ERROR' }),
      });
    },
  );

  it('rejects a slug that is not URL-safe', async () => {
    await expect(validate({ ...VALID_POST, slug: '../../etc/passwd' }, CreateBlogPostDto)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'VALIDATION_ERROR' }),
    });
  });

  it('accepts the randomUUID the browser actually sends as a visitorKey', async () => {
    await expect(
      validate({ visitorKey: '8f14e45f-ceea-467a-9575-9c6a6f34b0a1' }, BlogViewDto),
    ).resolves.toMatchObject({ visitorKey: '8f14e45f-ceea-467a-9575-9c6a6f34b0a1' });
  });

  it.each([
    ['too short', 'abc'],
    ['too long', 'a'.repeat(129)],
    ['not URL-safe', 'key with spaces'],
    ['not a string', 12345],
  ])('rejects a visitorKey that is %s', async (_case, visitorKey) => {
    await expect(validate({ visitorKey }, BlogViewDto)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'VALIDATION_ERROR' }),
    });
  });
});
