# syntax=docker/dockerfile:1.7
# ---------------------------------------------------------------------------
# ایمیج production برای @lingospeak/api (NestJS 11 + Prisma 6).
#
# ⚠ ایمیج پایه را به alpine عوض نکنید.
#   `prisma generate` در استیج builder موتور کوئری را برای libc همان ایمیج
#   می‌سازد. اگر builder و runtime از نظر libc فرق کنند (glibc در برابر musl)،
#   موتور در زمان اجرا لود نمی‌شود و خطا («Unable to require libquery_engine»)
#   ربطی به Prisma به نظر نمی‌رسد. هر دو استیج باید یک پایه داشته باشند.
#
# ساخت از ریشه‌ی مخزن:
#   docker build -f deploy/docker/api.Dockerfile -t lingospeak-api:latest .
# ---------------------------------------------------------------------------
ARG NODE_IMAGE=node:22-bookworm-slim

# ---------- base ----------
FROM ${NODE_IMAGE} AS base
# openssl را خود Prisma برای موتور کوئری لازم دارد؛ روی ایمیج slim نصب نیست.
RUN apt-get update \
	&& apt-get install -y --no-install-recommends openssl ca-certificates \
	&& rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ---------- deps ----------
# فقط مانیفست‌ها کپی می‌شوند تا این لایه با تغییر سورس بی‌اعتبار نشود.
FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/contracts/package.json ./packages/contracts/
# packages/contracts یک اسکریپت `prepare` دارد که tsc اجرا می‌کند. --ignore-scripts
# **آن را برای پکیج‌های workspace/local سرکوب نمی‌کند** (یک رفتار شناخته‌شده و
# مستندنشده‌ی npm) — و سورس اینجا هنوز کپی نشده، پس با «tsconfig.esm.json پیدا
# نشد» شکست می‌خورد. حذفش این‌جا تنها راه مطمئن است. استیج builder با
# `npm rebuild` هر اسکریپت نصبی که واقعاً لازم است را از نو اجرا می‌کند.
RUN npm pkg delete scripts.prepare -w @lingospeak/contracts
RUN npm ci --ignore-scripts

# ---------- builder ----------
# این استیج در فاز migrate هم مستقیم استفاده می‌شود: هم prisma CLI و هم tsx
# اینجا موجودند (هر دو devDependency) و لایه‌ها با runtime مشترک‌اند، پس
# دیسک اضافه‌ای مصرف نمی‌شود.
FROM deps AS builder
COPY tsconfig.base.json ./
COPY packages/contracts ./packages/contracts
COPY apps/api ./apps/api
RUN npm rebuild
RUN npm run build:contracts
# apps/api/prisma.config.ts می‌خواند `env('DATABASE_URL')` از پکیج
# `prisma/config` — این هلپر اگر متغیر غایب باشد throw می‌کند، حتی برای
# `generate` که هیچ اتصال واقعی به دیتابیس لازم ندارد. در dev این با
# apps/api/.env (که dotenv/config در همان فایل می‌خواند) پنهان می‌ماند؛ اینجا
# چنین فایلی عمداً کپی نشده (رمز دارد)، پس یک مقدار بی‌معنی فقط برای همین
# دستور کافی است.
RUN DATABASE_URL='postgresql://build:build@localhost:5432/build' npm run db:generate -w @lingospeak/api
RUN npm run build -w @lingospeak/api
# گارد سریع: اگر نقطه‌ی ورود جابه‌جا شود، همین‌جا شکست بخور نه در زمان اجرا.
RUN test -f apps/api/dist/apps/api/src/main.js

# ---------- runtime ----------
FROM base AS runtime
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/contracts/package.json ./packages/contracts/
# همان دلیل استیج deps: `prepare` بدون سورس شکست می‌خورد و --ignore-scripts
# آن را برای پکیج‌های workspace سرکوب نمی‌کند.
RUN npm pkg delete scripts.prepare -w @lingospeak/contracts
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# کلاینت تولیدشده‌ی Prisma و موتورهایش. با --ignore-scripts ساخته نمی‌شوند،
# پس از builder می‌آیند.
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# ‏dist کامپایل‌شده‌ی API با require("@lingospeak/contracts") صدا می‌زند؛ در زمان
# اجرا از طریق symlink ورک‌اسپیس (که npm ci ساخته) به همین dist می‌رسد.
COPY --from=builder /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist
# schema و migrations برای `prisma migrate status` و ابزارهای عیب‌یابی.
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma

USER node
WORKDIR /app/apps/api
EXPOSE 4001
# نقطه‌ی ورود تو در تو است چون tsconfig مسیر @lingospeak/contracts را به سورس
# نگاشت می‌کند و rootDir به ریشه‌ی مخزن پهن می‌شود. با apps/api/package.json
# هماهنگ است.
CMD ["node", "dist/apps/api/src/main.js"]
