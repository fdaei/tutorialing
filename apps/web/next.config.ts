import type { NextConfig } from 'next';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';

// `next build` always runs with cwd = apps/web, so the repo root is two levels
// up. Deliberately not import.meta.url: this package is CommonJS.
const repoRoot = resolve(process.cwd(), '..', '..');

// apps/web has no .env of its own. Root `npm run dev` passes the root .env via
// --env-file, but `npm run dev:web` and a bare `next dev`/`next build` don't, so
// NEXT_PUBLIC_S3_ORIGIN came out empty and the CSP (middleware.ts) blocked every
// MinIO image. Only NEXT_PUBLIC_* is taken, and real env vars (Docker build
// args, CI) still win.
const rootEnv = resolve(repoRoot, '.env');
if (existsSync(rootEnv)) {
  for (const [key, value] of Object.entries(parseEnv(readFileSync(rootEnv, 'utf8')))) {
    if (key.startsWith('NEXT_PUBLIC_')) process.env[key] ??= value;
  }
}

const remotePatterns: any[] = [];
if (process.env.NEXT_PUBLIC_S3_ORIGIN) {
  try {
    const url = new URL(process.env.NEXT_PUBLIC_S3_ORIGIN);
    remotePatterns.push({ protocol: url.protocol.replace(':', ''), hostname: url.hostname, port: url.port || '' });
  } catch {}
}

const config: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  output: 'standalone',
  outputFileTracingRoot: repoRoot,
  images: {
    remotePatterns: remotePatterns.length > 0 ? remotePatterns : [
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' } // Google Auth avatars
    ],
  },
};

export default config;
