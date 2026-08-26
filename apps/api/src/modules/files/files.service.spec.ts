// Set before importing FilesService: `filesConfig()` reads `config()`, which
// parses the environment, at class-property-initialisation time.
process.env.DATABASE_URL ??= 'postgresql://u:p@localhost:5432/db?schema=public';
process.env.JWT_ACCESS_SECRET ??= 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET ??= 'b'.repeat(32);
process.env.S3_ACCESS_KEY ??= 'minio';
process.env.S3_SECRET_KEY ??= 'secret';
process.env.S3_BUCKET ??= 'lingospeak';

const { FilesService } = require('./files.service') as typeof import('./files.service');

const OWNER = 'user-owner';
const OTHER = 'user-other';
const FILE = { id: 'file-1', key: `${OWNER}/verification/doc.pdf`, checksum: 'a'.repeat(64), status: 'SAFE' };

/**
 * Mirrors `download()`'s real `where` shape (`id`, `status: 'SAFE'`, and an
 * `OR` of `{ownerId: requesterId}` plus reviewer-only clauses) closely enough
 * that a caller whose id isn't the file's actual owner — and who isn't a
 * reviewer — genuinely gets no match, the way Prisma would. Necessary for
 * this to be a real SEC-210 regression test rather than one that "passes"
 * regardless of who's asking.
 */
function harness() {
  const findFirst = jest.fn().mockImplementation(({ where }: { where: { id: string; status: string; OR: { ownerId?: string }[] } }) => {
    const ownerMatch = where.OR.some((clause) => clause.ownerId === OWNER);
    // No verificationItems/testAnswers relations are set up on this fixture,
    // so the reviewer-only OR branches never match in this harness.
    const matches = where.id === FILE.id && where.status === 'SAFE' && ownerMatch;
    return Promise.resolve(matches ? FILE : null);
  });
  const db = { storedFile: { findFirst } };
  const storage = { createDownloadUrl: jest.fn().mockResolvedValue('https://storage.example/file') };
  const svc = new FilesService(db as never, storage as never);
  return { svc, findFirst };
}

describe('FilesService.download (SEC-210)', () => {
  it('rejects a different user downloading another user’s file', async () => {
    const { svc, findFirst } = harness();
    await expect(svc.download(OTHER, ['STUDENT'], FILE.id)).rejects.toMatchObject({
      response: { code: 'FILE_NOT_FOUND' },
    });
    expect(findFirst).toHaveBeenCalled();
  });

  it('rejects a staff-adjacent but non-reviewer role the same way', async () => {
    const { svc } = harness();
    await expect(svc.download(OTHER, ['SUPPORT'], FILE.id)).rejects.toMatchObject({
      response: { code: 'FILE_NOT_FOUND' },
    });
  });

  it('still lets the owning user download their own file', async () => {
    const { svc } = harness();
    const result = await svc.download(OWNER, ['STUDENT'], FILE.id);
    expect(result.url).toEqual(expect.any(String));
    expect(result.expiresIn).toEqual(expect.any(Number));
  });
});
