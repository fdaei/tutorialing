import '../src/env';
import { PrismaClient } from '@prisma/client';
import { seedCountries } from './country.seed';

const db = new PrismaClient();

seedCountries(db)
  .then((count) => console.log(`Seeded ${count} countries successfully.`))
  .catch((error) => {
    console.error('Country seed failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => db.$disconnect());
