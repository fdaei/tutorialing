import type { NextConfig } from 'next';
import { resolve } from 'node:path';

// `next build` always runs with cwd = apps/web, so the repo root is two levels
// up. Deliberately not import.meta.url: this package is CommonJS.
const repoRoot = resolve(process.cwd(), '..', '..');

const config: NextConfig = {
  // `next dev` and `next build` must not write into the same directory. Running
  // them concurrently otherwise leaves the dev runtime pointing at production
  // chunks that have already been replaced (MODULE_NOT_FOUND for numbered or
  // vendor chunks).
  distDir: process.env.NEXT_DIST_DIR ?? '.next',

  // Copies only the files actually imported next to a server.js instead of
  // shipping all of node_modules: ~1GB production image down to a few hundred MB.
  output: 'standalone',

  // npm workspaces hoists most dependencies to the repo-root node_modules, not
  // apps/web/node_modules. Without this, tracing starts at apps/web, misses the
  // hoisted packages, and the container dies at runtime with MODULE_NOT_FOUND.
  outputFileTracingRoot: repoRoot,
};

export default config;
