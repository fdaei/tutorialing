import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const dir = resolve(process.cwd(), '.next-dev');

await rm(dir, { recursive: true, force: true });
