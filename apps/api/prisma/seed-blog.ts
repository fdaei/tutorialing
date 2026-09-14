import '../src/env';
import { PrismaClient, Role } from '@prisma/client';
import { seedBlogPosts } from './blog-posts.seed';

// Production counterpart of the blog block in prisma/seed.ts: installs the
// editorial baseline articles only — no demo users — attributed to the oldest
// administrator, and never overwrites an article that already exists.
const db = new PrismaClient();

async function main() {
  const admin = await db.user.findFirst({
    where: { roles: { some: { role: Role.ADMIN } } },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (!admin) throw new Error('No ADMIN user exists to author the blog posts; create one first.');
  return seedBlogPosts(db, { authorId: admin.id });
}

main()
  .then((count) => console.log(`Seeded ${count} blog posts successfully.`))
  .catch((error) => {
    console.error('Blog seed failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => db.$disconnect());
