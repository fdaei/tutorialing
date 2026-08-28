import type { NextConfig } from 'next';

const config: NextConfig = {
  // `next dev` and `next build` must not write into the same directory. Running
  // them concurrently otherwise leaves the dev runtime pointing at production
  // chunks that have already been replaced (MODULE_NOT_FOUND for numbered or
  // vendor chunks).
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
};

export default config;
