import { copyFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const example = join(root, '.env.example');
const envTargets = [join(root, '.env'), join(root, 'apps/api/.env')];

for (const target of envTargets) {
  if (existsSync(target)) {
    console.log(`Environment file preserved: ${target.replace(`${root}/`, '')}`);
    continue;
  }
  copyFileSync(example, target);
  console.log(`Environment file created from .env.example: ${target.replace(`${root}/`, '')}`);
}

const requiredBins = ['prisma', 'nest', 'tsx'].map((name) =>
  join(root, 'node_modules', '.bin', process.platform === 'win32' ? `${name}.cmd` : name),
);

if (requiredBins.every(existsSync)) {
  console.log('Dependencies are already installed.');
  process.exit(0);
}

console.log('Dependencies are missing; running npm ci...');
const install = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['ci'], {
  cwd: root,
  stdio: 'inherit',
});

if (install.error) {
  console.error(`Blocking: unable to start npm ci: ${install.error.message}`);
  process.exit(1);
}
if (install.status !== 0) {
  console.error(`Blocking: npm ci failed with exit code ${install.status}.`);
  process.exit(install.status ?? 1);
}

if (!requiredBins.every(existsSync)) {
  console.error('Blocking: dependencies were installed but required Prisma/NestJS binaries are unavailable.');
  process.exit(1);
}

console.log('Environment and dependencies are ready.');
