import { existsSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { config as loadDotEnv } from 'dotenv';

const cwd = process.cwd();
const apiCwd = cwd.endsWith(`${sep}apps${sep}api`);
const candidates = apiCwd
  ? [resolve(cwd, '.env'), resolve(cwd, '../../.env')]
  : [resolve(cwd, 'apps/api/.env'), resolve(cwd, '.env')];

for (const path of candidates) {
  if (existsSync(path)) {
    loadDotEnv({ path, override: false, quiet: true });
  }
}
