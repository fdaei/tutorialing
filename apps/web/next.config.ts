import type { NextConfig } from 'next';
import { resolve } from 'node:path';

// `next build` همیشه با cwd برابر apps/web اجرا می‌شود (چه مستقیم، چه با
// `npm run build -w @lingospeak/web`)، پس ریشه‌ی مخزن دو سطح بالاتر است.
// عمداً از import.meta.url استفاده نشده: این پکیج CommonJS است.
const repoRoot = resolve(process.cwd(), '..', '..');

const config: NextConfig = {
  // `next dev` and `next build` must not write into the same directory. Running
  // them concurrently otherwise leaves the dev runtime pointing at production
  // chunks that have already been replaced (MODULE_NOT_FOUND for numbered or
  // vendor chunks).
  distDir: process.env.NEXT_DIST_DIR ?? '.next',

  // خروجی standalone: به جای نیاز داشتن به کل node_modules در زمان اجرا، فقط
  // فایل‌هایی که واقعاً import شده‌اند کنار یک server.js کپی می‌شوند. ایمیج
  // production را از حدود یک گیگابایت به چند صد مگابایت می‌رساند.
  output: 'standalone',

  // در npm workspaces بیشتر وابستگی‌ها به node_modules ریشه‌ی مخزن hoist
  // می‌شوند، نه apps/web/node_modules. بدون این خط، ردیابی فایل‌ها از
  // apps/web شروع می‌شود، بسته‌های hoist‌شده را جا می‌گذارد و کانتینر در زمان
  // اجرا با MODULE_NOT_FOUND می‌افتد.
  outputFileTracingRoot: repoRoot,
};

export default config;
