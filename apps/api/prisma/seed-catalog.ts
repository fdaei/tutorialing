import '../src/env';
import { PrismaClient } from '@prisma/client';
import { seedLingoSpeakCatalog } from './lingospeak-catalog.seed';

// Production counterpart of the catalog block in prisma/seed.ts: installs the
// institute's teachers and published courses only — no demo users, no fixed
// OTP — and never overwrites rows the admin panel has since edited.
const db = new PrismaClient();

seedLingoSpeakCatalog(db)
  .then((installed) => console.log(`Seeded LingoSpeak catalog for ${Object.keys(installed).length} teachers.`))
  .catch((error) => {
    console.error('Catalog seed failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => db.$disconnect());
