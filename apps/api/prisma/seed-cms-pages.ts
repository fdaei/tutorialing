import '../src/env';
import { PrismaClient } from '@prisma/client';
import { seedCmsPages } from './cms-pages.seed';

// Production counterpart of the CMS block in prisma/seed.ts. That seed also
// creates demo users with a fixed OTP and is never run against production, so
// production had no CmsPage rows at all and every footer link 404'd. This
// runner installs only the published content baseline — no users, no demo
// data — and leaves administrator-authored text untouched on re-runs.
const db = new PrismaClient();

seedCmsPages(db)
  .then((count) => console.log(`Seeded ${count} public CMS pages successfully.`))
  .catch((error) => {
    console.error('CMS page seed failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => db.$disconnect());
