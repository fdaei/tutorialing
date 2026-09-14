import type { NextConfig } from 'next';
import { resolve } from 'node:path';

// `next build` always runs with cwd = apps/web, so the repo root is two levels
// up. Deliberately not import.meta.url: this package is CommonJS.
const repoRoot = resolve(process.cwd(), '..', '..');

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
